# 技术分享模块（三期）实施计划 · W3 后台写平面 + W5 导入器

> **给执行者**：本文件是 [实施计划索引](plan-tech-module.md) 的第 3 份。执行方式：**内联逐任务执行、每个任务结束后复核并 commit**，用 `- [ ]` 跟踪。
> **前置**：W1、W2 全部任务完成且验收门全绿。
> **配套**：[设计定稿](design-tech-module.md)（已批准）· [开发日志](dev-journal.md) · [决策记录](decisions.md)

**Goal**：后台能真正写内容 —— 登录鉴权、文章的增/改/删/发布撤回、图片上传、审计留痕；外加一个**不暴露 HTTP** 的 Markdown 导入器 CLI。

**Architecture**：`web.admin`（`/v1/admin/**`，Sa-Token 拦截）→ `service`（事务边界 + 审计 + 缓存失效）→ `repository`。所有写操作都在 Service 的 `@Transactional` 里，**同一事务内写 `admin_audit_log`**。文件落 `infrastructure/storage`（`FileStorage` 接口 + `LocalFileStorage` 实现），将来换对象存储只改实现。

**Tech Stack**：Sa-Token 1.44.0（`StpUtil` + `SaInterceptor`）· `spring-security-crypto`（只取 `BCryptPasswordEncoder`，不引 Spring Security 框架）· SnakeYAML（Spring Boot 自带，解析 front-matter）· Redis 5.0.14

---

## 0. 本工作流修正了设计里的一处**不可行描述**（必须先读）

设计 D8 写的是「slug **自动从标题生成**、可手改」。**对中文标题这件事做不到**：把「三期后端复盘」转成 slug 需要拼音库，而本期没有批准新增该依赖。因此改为：

| 情形 | 行为 |
| --- | --- |
| 管理员填了 slug | 校验格式（`^[a-z0-9]+(-[a-z0-9]+)*$`，3–120 字符），直接用 |
| slug 留空且标题含拉丁字母/数字 | `SlugUtils.normalize(title)` 自动生成（转小写、非字母数字换 `-`、折叠连续 `-`） |
| slug 留空且标题**全是中文** | **不猜**，直接报 `40001 参数校验失败：请填写 slug`（前端把它做成必填 + 实时唯一性校验） |
| 兜底（导入器/接口调用没给） | 生成 `tech-{yyyyMMddHHmmss}`，保证不会插空 |

这条修正已回写 [设计文档 D8](design-tech-module.md)。

**另外定两条写路径约定**：

1. **slug 唯一性靠数据库的 `uk_type_slug` 兜底**，不是「先查再插」—— 后者在并发下必然有竞态。做法：先做一次友好预检（给用户明确的 40901），再捕获 `DuplicateKeyException` 作为权威判据。
2. **标签用「名字数组」进出**（`["Redis","并发"]`），由 Service **解析或创建**；本期不做独立标签管理接口（YAGNI）。

### 0.1 本文件写完后的 self-review 修正（6 处，全部会真的失败）

| # | 原写法 | 问题 | 改法 |
| --- | --- | --- | --- |
| 1 | 在 `@SpringBootTest`（非 web 上下文）里直接调 `adminAuthService.login(正确口令)` | `StpUtil.login()` 需要 **web 请求级上下文**，非 web 测试里会抛 `SaTokenContextException` —— 是**测法不对**，不是业务缺陷 | `AdminAuthServiceTest` 只留「失败/锁定/限流」三条（都在 `StpUtil.login` 之前抛）；成功路径（发 token、清计数、`/me`）全部挪到 `AdminAuthControllerTest` 走 MockMvc 真实链路 |
| 2 | `LocalFileStorage` 用 `@PostConstruct void prepare()` 建目录 | 方法包级私有，而测试在**另一个包**（`com.jcpress.infrastructure` vs `...storage`）→ 测不了；且失败要等第一次上传才暴露 | 目录改到**构造器**里建（启动即失败），删掉 `@PostConstruct`；测试直接 `new` 就能用 |
| 3 | 「超过大小上限」的测试用 **1MB 上限 + 2KB 文件** | 根本触发不到那条分支，是**假绿** | 测试辅助方法加 `maxBytes` 参数，该用例用 `storage(1024L)` + 2KB 文件 |
| 4 | `AdminArticleService` 只写了接口名，**`listForAdmin` / `getForAdmin` 没有实现代码**，而 `AdminArticleVO` 也没有 `contentMd` | 后台编辑页打不开（拿不到正文） | 补齐接口定义 + 两个方法的实现 + 转换私有方法；`AdminArticleVO` 增加 `contentMd`（仅详情填充，列表恒为 null） |
| 5 | 导入器新建分支 `article.setPublishTime(parseTime(...))` 可能为 null | `status=PUBLISHED` 但 front-matter 没给时间 → `publish_time` 为 NULL → **公开列表（要求 publish_time IS NOT NULL）看不见这篇** | 已发布但时间为空时兜底成 `now()` |
| 6 | `WebMvcConfig` 手拼 `"file:" + 绝对路径 + "/"` | Windows 反斜杠会得到一个 Spring 解析不了的 location | 改用 `Path.toUri().toString()`（`file:///C:/.../`） |

另外补了两处**声明缺漏**：`CategoryMapper.getByScopeAndSlug`（导入器把 `category: java-backend` 解析成 `category_id` 要用）、`ArticleMapper.listForAdmin`。

---

## 1. Task 1: 纯工具（Slug 与字数统计）

**Files:**
- Create: `backend/src/main/java/com/jcpress/common/util/SlugUtils.java`
- Create: `backend/src/main/java/com/jcpress/common/util/WordCountUtils.java`
- Test: `backend/src/test/java/com/jcpress/common/util/{SlugUtilsTest,WordCountUtilsTest}.java`

- [ ] **Step 1: 写失败测试**

```java
package com.jcpress.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SlugUtilsTest {

    @Test
    void normalizesLatinTitleToKebabCase() {
        assertThat(SlugUtils.normalize("Spring Boot 3 里替换 Jackson"))
                .isEqualTo("spring-boot-3");
    }

    @Test
    void collapsesSeparatorsAndTrims() {
        assertThat(SlugUtils.normalize("  Redis   ZSet -- 分片  "))
                .isEqualTo("redis-zset");
    }

    @Test
    void returnsNullWhenNothingUsableRemains() {
        // 全中文标题 → 不猜拼音，返回 null 让上层要求管理员手填
        assertThat(SlugUtils.normalize("三期后端复盘")).isNull();
    }

    @Test
    void validatesFormat() {
        assertThat(SlugUtils.isValid("phase-3-backend-retro")).isTrue();
        assertThat(SlugUtils.isValid("Phase-3")).isFalse();      // 大写不允许
        assertThat(SlugUtils.isValid("-leading")).isFalse();
        assertThat(SlugUtils.isValid("has_underscore")).isFalse();
        assertThat(SlugUtils.isValid("ab")).isFalse();           // 太短
    }
}
```

```java
package com.jcpress.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WordCountUtilsTest {

    @Test
    void countsCjkCharactersAndLatinWords() {
        // 9 个汉字 + 2 个英文词
        assertThat(WordCountUtils.count("把 Redis ZSet 分片写清楚")).isEqualTo(11);
    }

    @Test
    void markdownSyntaxIsNotCounted() {
        String markdown = """
                # 标题

                ![图](/uploads/a.png)

                ```java
                public class Demo {}
                ```

                正文两字
                """;
        // 只数可见正文：标题 2 + 正文 4 = 6（图片说明与外链不算中文字）
        assertThat(WordCountUtils.count(markdown)).isEqualTo(6);
    }

    @Test
    void readingMinutesFollowsFourHundredPerMinuteWithFloorOfOne() {
        assertThat(WordCountUtils.estimateReadingMinutes(0)).isEqualTo(1);
        assertThat(WordCountUtils.estimateReadingMinutes(400)).isEqualTo(1);
        assertThat(WordCountUtils.estimateReadingMinutes(401)).isEqualTo(2);
    }
}
```

- [ ] **Step 2: 跑测试确认失败**：`mvn -q test -Dtest='SlugUtilsTest,WordCountUtilsTest'` → 编译失败
- [ ] **Step 3: 写 `SlugUtils`**

```java
package com.jcpress.common.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

public final class SlugUtils {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 120;
    private static final Pattern VALID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private SlugUtils() {
    }

    /** 拉丁字母/数字 → kebab-case；全是中文（无可用字符）时返回 null —— 不猜拼音 */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String ascii = Normalizer.normalize(raw, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = NON_SLUG.matcher(ascii.toLowerCase()).replaceAll("-");
        slug = slug.replaceAll("(^-+)|(-+$)", "");
        return slug.length() < MIN_LENGTH ? null : truncate(slug);
    }

    public static boolean isValid(String slug) {
        return slug != null && slug.length() >= MIN_LENGTH && slug.length() <= MAX_LENGTH
                && VALID.matcher(slug).matches();
    }

    private static String truncate(String slug) {
        if (slug.length() <= MAX_LENGTH) {
            return slug;
        }
        String cut = slug.substring(0, MAX_LENGTH);
        int lastDash = cut.lastIndexOf('-');
        return lastDash > MIN_LENGTH ? cut.substring(0, lastDash) : cut;
    }
}
```

- [ ] **Step 4: 写 `WordCountUtils`**（先剥掉 Markdown 语法，再数汉字与拉丁词）

```java
package com.jcpress.common.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class WordCountUtils {

    /** 中文阅读速度按 400 字/分钟估算（写进设计 D3） */
    public static final int CHARS_PER_MINUTE = 400;

    private static final Pattern CODE_FENCE = Pattern.compile("(?s)```.*?```");
    private static final Pattern IMAGE = Pattern.compile("!\\[[^]]*]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^]]*)]\\([^)]*\\)");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final Pattern STRUCTURE = Pattern.compile("(?m)^\\s{0,3}(#{1,6}|[-*+]|\\d+\\.|>|\\|)");
    private static final Pattern CJK = Pattern.compile("[\\u4e00-\\u9fff\\u3400-\\u4dbf]");
    private static final Pattern LATIN_WORD = Pattern.compile("[A-Za-z][A-Za-z0-9'-]*");

    private WordCountUtils() {
    }

    public static int count(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return 0;
        }
        String text = CODE_FENCE.matcher(markdown).replaceAll(" ");
        text = IMAGE.matcher(text).replaceAll(" ");
        text = LINK.matcher(text).replaceAll("$1");
        text = HTML_TAG.matcher(text).replaceAll(" ");
        text = STRUCTURE.matcher(text).replaceAll("");

        int total = 0;
        Matcher cjk = CJK.matcher(text);
        while (cjk.find()) {
            total++;
        }
        Matcher latin = LATIN_WORD.matcher(text);
        while (latin.find()) {
            total++;
        }
        return total;
    }

    public static int estimateReadingMinutes(int wordCount) {
        if (wordCount <= 0) {
            return 1;
        }
        return Math.max(1, (int) Math.ceil((double) wordCount / CHARS_PER_MINUTE));
    }
}
```

- [ ] **Step 5: 跑测试**：`mvn -q test -Dtest='SlugUtilsTest,WordCountUtilsTest'` → PASS
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): Slug 与字数统计工具（中文标题不猜拼音，返回 null 由上层要求手填）"`

---

## 2. Task 2: 后台账号与审计的模型层

**Files:**
- Create: `backend/src/main/java/com/jcpress/domain/dataobject/{AdminUserDO,AdminAuditLogDO}.java`
- Create: `backend/src/main/java/com/jcpress/repository/{AdminUserMapper,AdminAuditLogMapper}.java` + `resources/mapper/AdminUserMapper.xml`
- Create: `backend/src/main/java/com/jcpress/domain/dto/{AdminLoginDTO,AuditLogDTO}.java`
- Create: `backend/src/main/java/com/jcpress/domain/vo/{AdminUserVO,LoginVO}.java`
- Create: `backend/src/main/java/com/jcpress/common/constant/{AuditActionConstant,AdminConstant}.java`

- [ ] **Step 1: 写 DO**（字段表照 §6.1 的 DDL）

| 类 | `@TableName` | 字段 |
| --- | --- | --- |
| `AdminUserDO` | `admin_user` | `id`(`@TableId(AUTO)`)、`username`、`passwordHash`、`nickname`、`role`、`status`(Integer)、`lastLoginTime`、`lastLoginIp`、`gmtCreate`、`gmtModified` |
| `AdminAuditLogDO` | `admin_audit_log` | `id`(`@TableId(AUTO)`)、`adminId`、`action`、`targetType`、`targetId`、`detail`、`ip`、`userAgent`、`gmtCreate` |

- [ ] **Step 2: 写 `AdminUserMapper`**（动词前缀；用 XML 写按用户名查询）

```java
package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.AdminUserDO;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

public interface AdminUserMapper extends BaseMapper<AdminUserDO> {

    AdminUserDO getByUsername(@Param("username") String username);

    int updateLastLogin(@Param("id") Long id, @Param("loginTime") LocalDateTime loginTime,
                        @Param("loginIp") String loginIp);
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.jcpress.repository.AdminUserMapper">

    <select id="getByUsername" resultType="com.jcpress.domain.dataobject.AdminUserDO">
        SELECT id, username, password_hash, nickname, role, status,
               last_login_time, last_login_ip, gmt_create, gmt_modified
        FROM admin_user
        WHERE username = #{username}
        LIMIT 1
    </select>

    <update id="updateLastLogin">
        UPDATE admin_user SET last_login_time = #{loginTime}, last_login_ip = #{loginIp} WHERE id = #{id}
    </update>
</mapper>
```

- [ ] **Step 3: 写常量与 DTO/VO**

```java
package com.jcpress.common.constant;

public final class AuditActionConstant {

    public static final String LOGIN = "LOGIN";
    public static final String LOGOUT = "LOGOUT";
    public static final String CREATE = "CREATE";
    public static final String UPDATE = "UPDATE";
    public static final String DELETE = "DELETE";
    public static final String PUBLISH = "PUBLISH";
    public static final String UPLOAD = "UPLOAD";

    private AuditActionConstant() {
    }
}
```

```java
package com.jcpress.common.constant;

public final class AdminConstant {

    public static final int STATUS_ENABLED = 1;
    public static final int STATUS_DISABLED = 0;
    /** 连续失败 5 次锁定 15 分钟（规划 §7 的 login:fail:{username}） */
    public static final int LOGIN_FAIL_LIMIT = 5;
    public static final long LOGIN_FAIL_WINDOW_SECONDS = 900L;
    /** 登录接口限流：同一 IP 每分钟 10 次 */
    public static final int LOGIN_RATE_LIMIT = 10;
    public static final long LOGIN_RATE_WINDOW_SECONDS = 60L;
    public static final String TARGET_TYPE_ARTICLE = "ARTICLE";

    private AdminConstant() {
    }
}
```

| 类 | 字段（含校验注解） |
| --- | --- |
| `AdminLoginDTO` | `username`(`@NotBlank` `@Size(max=32)`)、`password`(`@NotBlank` `@Size(min=6,max=64)`) |
| `AuditLogDTO` | `adminId`(Long)、`action`(String)、`targetType`(String)、`targetId`(Long)、`detail`(String)、`ip`(String)、`userAgent`(String) |
| `AdminUserVO` | `id`、`username`、`nickname`、`role`（**不含 passwordHash**） |
| `LoginVO` | `token`(String)、`tokenName`(String，值 `jcpress-token`)、`admin`(`AdminUserVO`) |

- [ ] **Step 4: 写 `AuditLogDTO` → DO 的转换**（放 `domain/converter/AdminConverter.java`：`toAdminUserVO(AdminUserDO)`、`toAuditLogDO(AuditLogDTO)`）
- [ ] **Step 5: 跑编译**：`mvn -q -DskipTests compile` → exit 0
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): 后台账号与审计的模型层（DO/Mapper/DTO/VO/常量）"`

---

## 3. Task 3: 登录服务（BCrypt + 失败锁定 + 限流）

**Files:**
- Create: `backend/src/main/java/com/jcpress/manager/RateLimitManager.java`
- Create: `backend/src/main/java/com/jcpress/service/AdminAuthService.java` + `service/impl/AdminAuthServiceImpl.java`
- Create: `backend/src/main/java/com/jcpress/infrastructure/config/SecurityConfig.java`（只注册 `PasswordEncoder` Bean）
- Test: `backend/src/test/java/com/jcpress/service/AdminAuthServiceTest.java`

- [ ] **Step 1: 写 `SecurityConfig`**（**只取 BCrypt 工具类，不引入 Spring Security 框架** —— 规划 §5.5）

```java
package com.jcpress.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

- [ ] **Step 2: 写 `RateLimitManager`**（Redis `INCR` + `EXPIRE`；**只有 Redis 5 就有的命令**）

```java
package com.jcpress.manager;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class RateLimitManager {

    private final StringRedisTemplate redis;

    /** 固定窗口计数：第一次计数时设置 TTL，返回 true 表示本次允许 */
    public boolean tryAcquire(String key, int limit, Duration window) {
        Long current = redis.opsForValue().increment(key);
        if (current != null && current == 1L) {
            redis.expire(key, window);
        }
        return current != null && current <= limit;
    }

    /** 只累加并返回当前值（用于失败次数这种"先记账、再判阈值"的场景），首次设置 TTL */
    public long countUp(String key, Duration window) {
        Long current = redis.opsForValue().increment(key);
        if (current != null && current == 1L) {
            redis.expire(key, window);
        }
        return current == null ? 0L : current;
    }

    public long getCount(String key) {
        String value = redis.opsForValue().get(key);
        return value == null ? 0L : Long.parseLong(value);
    }

    public void reset(String key) {
        redis.delete(key);
    }
}
```

- [ ] **Step 3: 写失败测试**

```java
package com.jcpress.service;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.vo.LoginVO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * ⚠️ 这里**只测失败路径**，不测「登录成功」。
 *
 * 原因（写计划时发现的坑）：成功路径会走到 `StpUtil.login()`，而 Sa-Token 的上下文是
 * **web 请求级**的 —— 在非 web 的 `@SpringBootTest` 里调用会抛 SaTokenContextException
 * （"非 web 上下文无法获取 Request"）。那不是业务缺陷，是**测法不对**。
 *
 * 所以：失败/锁定/限流（全都发生在 StpUtil.login 之前）在本类用真 Redis 测；
 * 「登录成功 → 发 token → 清失败计数 → /me 回显」全部由 `AdminAuthControllerTest` 走 MockMvc 真实链路覆盖。
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminAuthServiceTest {

    @Autowired AdminAuthService adminAuthService;
    @Autowired StringRedisTemplate redis;

    private AdminLoginDTO login(String username, String password) {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername(username);
        dto.setPassword(password);
        return dto;
    }

    @AfterEach
    void tearDown() {
        redis.delete("login:fail:admin");
        redis.delete("rate:127.0.0.1:login");
        for (int i = 0; i < 12; i++) {
            redis.delete("login:fail:probe-" + i);
        }
    }

    @Test
    void wrongPasswordIsRejectedAndCounted() {
        BusinessException e = catchThrowableOfType(BusinessException.class,
                () -> adminAuthService.login(login("admin", "wrong-password"), "127.0.0.1", "JUnit"));

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.NOT_LOGIN.getCode());
        assertThat(redis.opsForValue().get("login:fail:admin")).isEqualTo("1");
    }

    @Test
    void fifthFailureLocksTheAccountWithinWindow() {
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> adminAuthService.login(login("admin", "wrong-password"), "127.0.0.1", "JUnit"))
                    .isInstanceOf(BusinessException.class);
        }
        // 第 6 次即便给对的口令也必须先被锁定拦住（锁定判定在口令校验之前）
        BusinessException e = catchThrowableOfType(BusinessException.class,
                () -> adminAuthService.login(login("admin", "jcpress@2026"), "127.0.0.1", "JUnit"));
        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.LOGIN_FAIL_LOCKED.getCode());
    }

    @Test
    void loginRateLimitBlocksTheEleventhAttemptFromSameIp() {
        // 用 10 个不同用户名，避免先撞上"失败锁定"而根本测不到限流
        for (int i = 0; i < 10; i++) {
            int index = i;
            assertThatThrownBy(() -> adminAuthService.login(login("probe-" + index, "wrong-password"),
                    "127.0.0.1", "JUnit")).isInstanceOf(BusinessException.class);
        }
        BusinessException e = catchThrowableOfType(BusinessException.class,
                () -> adminAuthService.login(login("probe-10", "wrong-password"), "127.0.0.1", "JUnit"));
        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.RATE_LIMITED.getCode());
    }
}
```

- [ ] **Step 4: 写实现**（顺序很重要：**先查锁定 → 再校验口令 → 成功后清计数**；审计在同一事务）

```java
package com.jcpress.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.converter.AdminConverter;
import com.jcpress.domain.dataobject.AdminUserDO;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.vo.LoginVO;
import com.jcpress.manager.RateLimitManager;
import com.jcpress.repository.AdminUserMapper;
import com.jcpress.service.AdminAuthService;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuthServiceImpl implements AdminAuthService {

    private static final String FAIL_KEY = "login:fail:%s";
    private static final String RATE_KEY = "rate:%s:login";

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitManager rateLimitManager;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public LoginVO login(AdminLoginDTO dto, String clientIp, String userAgent) {
        String failKey = FAIL_KEY.formatted(dto.getUsername());
        if (rateLimitManager.getCount(failKey) >= AdminConstant.LOGIN_FAIL_LIMIT) {
            throw new BusinessException(ErrorCodeEnum.LOGIN_FAIL_LOCKED);
        }
        String rateKey = RATE_KEY.formatted(clientIp);
        if (!rateLimitManager.tryAcquire(rateKey, AdminConstant.LOGIN_RATE_LIMIT,
                Duration.ofSeconds(AdminConstant.LOGIN_RATE_WINDOW_SECONDS))) {
            throw new BusinessException(ErrorCodeEnum.RATE_LIMITED);
        }

        AdminUserDO admin = adminUserMapper.getByUsername(dto.getUsername());
        if (admin == null || !passwordEncoder.matches(dto.getPassword(), admin.getPasswordHash())) {
            long failures = rateLimitManager.countUp(failKey,
                    Duration.ofSeconds(AdminConstant.LOGIN_FAIL_WINDOW_SECONDS));
            log.warn("后台登录失败 username={} ip={} 累计失败={}", dto.getUsername(), clientIp, failures);
            throw new BusinessException(ErrorCodeEnum.NOT_LOGIN, "用户名或密码错误");
        }
        if (admin.getStatus() == null || admin.getStatus() != AdminConstant.STATUS_ENABLED) {
            throw new BusinessException(ErrorCodeEnum.FORBIDDEN, "账号已禁用");
        }

        rateLimitManager.reset(failKey);
        StpUtil.login(admin.getId());
        adminUserMapper.updateLastLogin(admin.getId(), LocalDateTime.now(), clientIp);

        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(admin.getId());
        audit.setAction(AuditActionConstant.LOGIN);
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);

        LoginVO vo = new LoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setTokenName(StpUtil.getTokenName());
        vo.setAdmin(AdminConverter.toAdminUserVO(admin));
        return vo;
    }

    @Override
    public void logout(String clientIp, String userAgent) {
        Long adminId = StpUtil.getLoginIdAsLong();
        StpUtil.logout();
        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(AuditActionConstant.LOGOUT);
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);
    }

    @Override
    public AdminUserVO getCurrentAdmin() {
        Long adminId = StpUtil.getLoginIdAsLong();
        AdminUserDO admin = adminUserMapper.selectById(adminId);
        if (admin == null) {
            throw new BusinessException(ErrorCodeEnum.NOT_LOGIN);
        }
        return AdminConverter.toAdminUserVO(admin);
    }
}
```

> **注意实现里的一个细节**：失败计数用的是 `rateLimitManager.countUp(failKey, window)` —— 只累加并在首次设置 TTL，「是否已锁定」由上面的 `getCount >= 5` 判定。这样不会出现两套计数逻辑。

- [ ] **Step 5: 写 `AuditLogService` + impl**（薄：DTO → DO → insert；`saveLog` 前缀合规）

```java
package com.jcpress.service;

import com.jcpress.domain.dto.AuditLogDTO;

public interface AuditLogService {

    void saveLog(AuditLogDTO auditLogDTO);
}
```

```java
package com.jcpress.service.impl;

import com.jcpress.domain.converter.AdminConverter;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.repository.AdminAuditLogMapper;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AdminAuditLogMapper adminAuditLogMapper;

    @Override
    public void saveLog(AuditLogDTO auditLogDTO) {
        adminAuditLogMapper.insert(AdminConverter.toAuditLogDO(auditLogDTO));
    }
}
```

- [ ] **Step 6: 跑测试**：`mvn -q test -Dtest=AdminAuthServiceTest` → PASS（4 个用例）
- [ ] **Step 7: Commit**：`git commit -m "feat(backend): 后台登录服务（BCrypt + 15 分钟失败锁定 + 登录限流 + 审计）"`

---

## 4. Task 4: 后台鉴权入口与 401 行为

**Files:**
- Create: `backend/src/main/java/com/jcpress/web/admin/controller/AdminAuthController.java`
- Test: `backend/src/test/java/com/jcpress/web/admin/AdminAuthControllerTest.java`

- [ ] **Step 1: 写 Controller**

```java
package com.jcpress.web.admin.controller;

import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.vo.AdminUserVO;
import com.jcpress.domain.vo.LoginVO;
import com.jcpress.service.AdminAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/admin/auth")
@RequiredArgsConstructor
@Tag(name = "后台认证")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @PostMapping("/login")
    @Operation(summary = "登录（无需鉴权，受限流与失败锁定）")
    public Result<LoginVO> login(@RequestBody @Valid AdminLoginDTO dto, HttpServletRequest request) {
        return Result.success(adminAuthService.login(dto, IpUtils.getClientIp(request),
                request.getHeader("User-Agent")));
    }

    @PostMapping("/logout")
    @Operation(summary = "登出")
    public Result<Void> logout(HttpServletRequest request) {
        adminAuthService.logout(IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }

    @GetMapping("/me")
    @Operation(summary = "当前登录账号")
    public Result<AdminUserVO> me() {
        return Result.success(adminAuthService.getCurrentAdmin());
    }
}
```

- [ ] **Step 2: 把 Sa-Token 的未登录异常翻译成 401 + `40101`** —— 在 `GlobalExceptionHandler` 里加两个 handler（**这一步必须做，否则未登录会变成 500**）

```java
    @ExceptionHandler(cn.dev33.satoken.exception.NotLoginException.class)
    public ResponseEntity<Result<Void>> handleNotLogin(cn.dev33.satoken.exception.NotLoginException e) {
        // 口径固定成：完全没带 token → 40101 未登录；带了但无效/过期/被顶下线 → 40102
        ErrorCodeEnum errorCode = cn.dev33.satoken.exception.NotLoginException.NOT_TOKEN.equals(e.getType())
                ? ErrorCodeEnum.NOT_LOGIN
                : ErrorCodeEnum.TOKEN_INVALID;
        return ResponseEntity.status(errorCode.getHttpStatus()).body(Result.error(errorCode));
    }
```

- [ ] **Step 3: 写测试**（`@SpringBootTest` + 真容器：验证「未登录 401」与「登录后 200」两条真实链路；**不用 MockMvc 切片**，因为拦截器要在真实链路里才生效）

```java
package com.jcpress.web.admin;

import com.jcpress.domain.dto.AdminLoginDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import com.google.gson.Gson;
import com.jcpress.infrastructure.config.GsonConfig;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired StringRedisTemplate redis;
    private final Gson gson = GsonConfig.buildGson();

    /** 走真实链路登录，返回 token（成功路径的断言都建立在这条链路上） */
    private String login() throws Exception {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername("admin");
        dto.setPassword("jcpress@2026");
        MvcResult result = mockMvc.perform(post("/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(gson.toJson(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenName").value("jcpress-token"))
                .andReturn();
        return com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.token");
    }

    @BeforeEach
    void clearCounters() {
        redis.delete("login:fail:admin");
        redis.delete("rate:127.0.0.1:login");
    }

    @AfterEach
    void tearDown() {
        redis.delete("login:fail:admin");
        redis.delete("rate:127.0.0.1:login");
    }

    @Test
    void meWithoutTokenIsUnauthorizedWith40101() throws Exception {
        mockMvc.perform(get("/v1/admin/auth/me"))
               .andExpect(status().isUnauthorized())
               .andExpect(jsonPath("$.code").value(40101));   // 完全没带 token → 40101 未登录
    }

    @Test
    void invalidTokenIsUnauthorizedWith40102() throws Exception {
        mockMvc.perform(get("/v1/admin/auth/me").header("jcpress-token", "not-a-real-token"))
               .andExpect(status().isUnauthorized())
               .andExpect(jsonPath("$.code").value(40102));   // 带了但无效 → 40102
    }

    @Test
    void successfulLoginResetsFailureCounter() throws Exception {
        // 先制造一次失败，再用正确口令登录：计数器必须被清掉（成功路径的其余断言也都在这里覆盖）
        redis.delete("login:fail:admin");
        AdminLoginDTO wrong = new AdminLoginDTO();
        wrong.setUsername("admin");
        wrong.setPassword("wrong-password");
        mockMvc.perform(post("/v1/admin/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(wrong)));
        assertThat(redis.opsForValue().get("login:fail:admin")).isEqualTo("1");

        login();   // 见 @BeforeEach 的辅助方法
        assertThat(redis.hasKey("login:fail:admin")).isFalse();
    }

    @Test
    void loginThenMeReturnsCurrentAdmin() throws Exception {
        String token = login();

        mockMvc.perform(get("/v1/admin/auth/me").header("jcpress-token", token))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.data.username").value("admin"))
               .andExpect(jsonPath("$.data.role").value("ADMIN"))
               .andExpect(jsonPath("$.data.passwordHash").value(org.hamcrest.Matchers.nullValue()));
    }
}
```

- [ ] **Step 4: 跑测试**：`mvn -q test -Dtest=AdminAuthControllerTest` → PASS（4 个用例）
- [ ] **Step 5: Commit**：`git commit -m "feat(backend): 后台认证接口 + Sa-Token 未登录异常翻译成 401（40101/40102 两个口径）"`

---

## 5. Task 5: 图片上传（本地存储 + 白名单 + magic bytes）

**Files:**
- Create: `backend/src/main/java/com/jcpress/infrastructure/storage/{FileStorage,LocalFileStorage,StoredFile}.java`
- Create: `backend/src/main/java/com/jcpress/domain/vo/UploadFileVO.java`
- Create: `backend/src/main/java/com/jcpress/service/FileStorageService.java` + `service/impl/FileStorageServiceImpl.java`
- Create: `backend/src/main/java/com/jcpress/web/admin/controller/AdminUploadController.java`
- Modify: `backend/src/main/java/com/jcpress/infrastructure/config/WebMvcConfig.java`（静态资源映射 `/uploads/**`）
- Test: `backend/src/test/java/com/jcpress/infrastructure/LocalFileStorageTest.java`

- [ ] **Step 1: 写 `FileStorage` 接口与实现**（**安全清单**：扩展名白名单 + MIME + magic bytes + 大小 + 重命名 + 禁路径穿越）

```java
package com.jcpress.infrastructure.storage;

import org.springframework.web.multipart.MultipartFile;

public interface FileStorage {

    StoredFile save(MultipartFile file);
}
```

```java
package com.jcpress.infrastructure.storage;

import lombok.Value;

@Value
public class StoredFile {

    /** 可访问的相对 URL，如 /uploads/2026/10/ab12cd34.png */
    String url;
    /** 落盘的绝对路径，便于排障与将来迁移 */
    String absolutePath;
    long size;
}
```

```java
package com.jcpress.infrastructure.storage;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
@Slf4j
public class LocalFileStorage implements FileStorage {

    private static final DateTimeFormatter DATE_DIR = DateTimeFormatter.ofPattern("yyyy/MM");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");
    /** magic bytes：不允许只看扩展名（扩展名可伪造） */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] GIF = {'G', 'I', 'F', '8'};
    private static final byte[] WEBP_RIFF = {'R', 'I', 'F', 'F'};

    private final Path rootDir;
    private final String resourcePath;
    private final String publicPrefix;
    private final long maxBytes;

    public LocalFileStorage(@Value("${jcpress.upload.dir:./uploads}") String dir,
                            @Value("${jcpress.upload.resource-path:/uploads}") String resourcePath,
                            @Value("${jcpress.upload.public-prefix:/api/uploads}") String publicPrefix,
                            @Value("${jcpress.upload.max-bytes:5242880}") long maxBytes) {
        this.rootDir = Path.of(dir).toAbsolutePath().normalize();
        this.resourcePath = resourcePath;
        this.publicPrefix = publicPrefix;
        this.maxBytes = maxBytes;
        // 目录在构造期建好：① 不依赖 @PostConstruct（单测直接 new 就能用）；
        //                      ② 启动即失败，而不是等到第一次上传才失败
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建上传目录 " + this.rootDir, e);
        }
        log.info("本地上传目录就绪 dir={} resourcePath={} publicPrefix={} maxBytes={}",
                this.rootDir, resourcePath, publicPrefix, maxBytes);
    }

    /**
     * ⚠️ 两个前缀**不能是同一个值**：
     * `resource-path` 是 `addResourceHandlers` 注册用的、**相对 context-path** 的路径（`/uploads`）；
     * `public-prefix` 是写进 Markdown / 存库的**对外可访问 URL 前缀**（`/api/uploads`，含 context-path）。
     * 混用会得到一个 404 的图片地址 —— 而这只会在肉眼看图时才发现。
     */
    public String getPublicPrefix() {
        return publicPrefix;
    }

    @Override
    public StoredFile save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件为空");
        }
        if (file.getSize() > maxBytes) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件超过大小上限");
        }
        String extension = resolveExtension(file.getOriginalFilename());
        try (InputStream in = file.getInputStream()) {
            if (!matchesMagicBytes(in, extension)) {
                throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件内容与扩展名不符");
            }
        } catch (IOException e) {
            throw new BusinessException(ErrorCodeEnum.OPERATION_ERROR, "读取上传文件失败");
        }

        String relativeDir = LocalDate.now().format(DATE_DIR);
        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = rootDir.resolve(relativeDir).resolve(filename).normalize();
        // 路径穿越的最后一道闸：规范化后必须仍在根目录内
        if (!target.startsWith(rootDir)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "非法的上传路径");
        }
        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target.toFile());
        } catch (IOException e) {
            log.error("写入上传文件失败 target={}", target, e);
            throw new BusinessException(ErrorCodeEnum.OPERATION_ERROR, "保存文件失败");
        }
        return new StoredFile(publicPrefix + "/" + relativeDir + "/" + filename, target.toString(), file.getSize());
    }

    private String resolveExtension(String originalFilename) {
        if (originalFilename == null) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "缺少文件名");
        }
        String name = originalFilename.toLowerCase(Locale.ROOT);
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "非法文件名");
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "缺少扩展名");
        }
        String extension = name.substring(dot + 1);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "不支持的文件类型");
        }
        return "jpeg".equals(extension) ? "jpg" : extension;
    }

    private boolean matchesMagicBytes(InputStream in, String extension) throws IOException {
        byte[] head = in.readNBytes(12);
        return switch (extension) {
            case "png" -> startsWith(head, PNG);
            case "jpg" -> startsWith(head, JPEG);
            case "gif" -> startsWith(head, GIF);
            case "webp" -> startsWith(head, WEBP_RIFF) && head.length >= 12
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
            default -> false;
        };
    }

    private boolean startsWith(byte[] head, byte[] prefix) {
        if (head.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (head[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
```

- [ ] **Step 2: 写 `WebMvcConfig`**（静态映射；`context-path=/api` 决定最终 URL 是 `/api/uploads/...`）

```java
package com.jcpress.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${jcpress.upload.dir:./uploads}")
    private String uploadDir;
    /** 这里必须是**相对 context-path** 的路径（/uploads），不是对外 URL（/api/uploads） */
    @Value("${jcpress.upload.resource-path:/uploads}")
    private String resourcePath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 用 toUri()：Windows 上手拼 "file:" + 反斜杠路径会得到一个 Spring 解析不了的 location
        String location = java.nio.file.Path.of(uploadDir).toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler(resourcePath + "/**").addResourceLocations(location);
    }
}
```

> **两个前缀的分工（踩过才知道）**：`resource-path=/uploads` 决定**服务端从哪个路径提供文件**（因为 `context-path=/api`，最终对外是 `/api/uploads/...`）；`public-prefix=/api/uploads` 决定**写进正文与库里的 URL**。两者要是写成同一个值，正文里的图片地址就是 404 —— 而这只会在肉眼看图时才暴露。`application.yml` 里两个键都要配：

```yaml
jcpress:
  upload:
    dir: ./uploads
    resource-path: /uploads        # 服务端映射（相对 context-path）
    public-prefix: /api/uploads    # 对外 URL（含 context-path），正文与封面用它
    max-bytes: 5242880
```

- [ ] **Step 3: 写 Service + Controller**

```java
package com.jcpress.service;

import com.jcpress.domain.vo.UploadFileVO;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    UploadFileVO saveImage(MultipartFile file);
}
```

```java
package com.jcpress.service.impl;

import com.jcpress.domain.vo.UploadFileVO;
import com.jcpress.infrastructure.storage.FileStorage;
import com.jcpress.infrastructure.storage.StoredFile;
import com.jcpress.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FileStorageServiceImpl implements FileStorageService {

    private final FileStorage fileStorage;

    @Override
    public UploadFileVO saveImage(org.springframework.web.multipart.MultipartFile file) {
        StoredFile stored = fileStorage.save(file);
        UploadFileVO vo = new UploadFileVO();
        vo.setUrl(stored.getUrl());
        vo.setSize(stored.getSize());
        return vo;
    }
}
```

```java
package com.jcpress.web.admin.controller;

import com.jcpress.common.result.Result;
import com.jcpress.domain.vo.UploadFileVO;
import com.jcpress.service.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/admin/upload")
@RequiredArgsConstructor
@Tag(name = "后台上传")
public class AdminUploadController {

    private final FileStorageService fileStorageService;

    @PostMapping
    @Operation(summary = "图片上传（jpg/jpeg/png/webp/gif，≤5MB）")
    public Result<UploadFileVO> upload(@RequestParam("file") MultipartFile file) {
        return Result.success(fileStorageService.saveImage(file));
    }
}
```

- [ ] **Step 4: 写存储测试**（用真实临时目录 + 真实字节；四类 magic bytes 各一条，另加"扩展名骗人"一条）

```java
package com.jcpress.infrastructure;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.infrastructure.storage.LocalFileStorage;
import com.jcpress.infrastructure.storage.StoredFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileStorageTest {

    @TempDir Path tempDir;

    private LocalFileStorage storage(long maxBytes) {
        return new LocalFileStorage(tempDir.toString(), "/uploads", "/api/uploads", maxBytes);
    }

    private LocalFileStorage storage() {
        return storage(1024L * 1024L);
    }

    private static final byte[] REAL_PNG = {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13};

    @Test
    void realPngIsStoredUnderDateDirectoryWithRandomName() {
        StoredFile stored = storage().save(
                new MockMultipartFile("file", "shot.PNG", "image/png", REAL_PNG));

        assertThat(stored.getUrl()).matches("/api/uploads/\\d{4}/\\d{2}/[0-9a-f]{32}\\.png");
        assertThat(Files.exists(Path.of(stored.getAbsolutePath()))).isTrue();
    }

    @Test
    void extensionThatLiesAboutContentIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "evil.png", "image/png",
                "<?php system($_GET['c']); ?>".getBytes());

        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件内容与扩展名不符");
    }

    @Test
    void disallowedExtensionIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "run.jsp", "image/png", REAL_PNG);
        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("不支持的文件类型");
    }

    @Test
    void pathTraversalInFilenameIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "../config/app.png", "image/png", REAL_PNG);
        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("非法文件名");
    }

    @Test
    void oversizedFileIsRejected() {
        byte[] big = new byte[2048];
        System.arraycopy(REAL_PNG, 0, big, 0, REAL_PNG.length);
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", big);

        // 上限设成 1024 才会真的触发「超过大小上限」—— 用 1MB 的上限配 2KB 的文件是测不到这条的
        assertThatThrownBy(() -> storage(1024L).save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件超过大小上限");
    }
}
```

- [ ] **Step 5: 跑测试**：`mvn -q test -Dtest=LocalFileStorageTest` → PASS（5 个用例）
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): 图片上传（本地存储 + 扩展名白名单 + magic bytes + 路径穿越防护）"`

---

## 6. Task 6: 后台文章写服务（增/改/删/发布 + 标签 + 审计）

**Files:**
- Create: `backend/src/main/java/com/jcpress/domain/dto/{ArticleSaveDTO,ArticleUpdateDTO}.java`
- Create: `backend/src/main/java/com/jcpress/domain/query/AdminArticleQuery.java`
- Create: `backend/src/main/java/com/jcpress/domain/vo/AdminArticleVO.java`
- Create: `backend/src/main/java/com/jcpress/service/AdminArticleService.java` + `service/impl/AdminArticleServiceImpl.java`
- Modify: `backend/src/main/java/com/jcpress/repository/ArticleMapper.java` + `resources/mapper/ArticleMapper.xml`（后台列表：含草稿 + keyword）
- Modify: `backend/src/main/java/com/jcpress/repository/TagMapper.java` + XML（按 slug 查、插入）
- Test: `backend/src/test/java/com/jcpress/service/AdminArticleServiceTest.java`

- [ ] **Step 1: 写 DTO/Query/VO**

| 类 | 字段（含校验） |
| --- | --- |
| `ArticleSaveDTO` | `title`(`@NotBlank` `@Size(max=200)`)、`slug`(`@Size(max=120)`，可空)、`summary`(`@Size(max=500)`)、`coverUrl`(`@Size(max=255)`)、`categoryId`(Long，`@NotNull`)、`tags`(`List<String>`，≤6 个)、`contentMd`(`@NotBlank`)、`status`(Integer，0/1，默认 0) |
| `ArticleUpdateDTO` | 同 `ArticleSaveDTO` + `id`(`@NotNull`) |
| `AdminArticleQuery extends PageQuery` | `status`(Integer，可空=全部)、`categoryId`(Long)、`keyword`(String) |
| `AdminArticleVO` | `id`、`title`、`slug`、`summary`、`categoryId`、`categoryName`、`tags`(`List<String>`，**标签名**，编辑器直用)、`status`、`wordCount`、`readingMinutes`、`viewCount`、`top`、`publishTime`、`gmtModified`、`contentMd`(**仅 `getForAdmin` 填充，列表里恒为 null**) |

- [ ] **Step 2: 写失败测试**（覆盖：新建落库+标签+审计、更新重算字数、slug 冲突 40901、发布写 publish_time、撤回不改 publish_time、删除级联清正文与标签）

```java
package com.jcpress.service;

import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class AdminArticleServiceTest {

    @Autowired AdminArticleService adminArticleService;
    @Autowired ArticleMapper articleMapper;
    @Autowired ArticleContentMapper articleContentMapper;
    @Autowired ArticleTagMapper articleTagMapper;
    @Autowired JdbcTemplate jdbcTemplate;

    private Long createdId;

    @AfterEach
    void tearDown() {
        if (createdId != null) {
            articleContentMapper.deleteById(createdId);
            articleMapper.deleteById(createdId);
        }
    }

    private ArticleSaveDTO saveDto(String slug) {
        ArticleSaveDTO dto = new ArticleSaveDTO();
        dto.setTitle("后台写入的测试文章");
        dto.setSlug(slug);
        dto.setSummary("摘要");
        dto.setCategoryId(2L);
        dto.setTags(List.of("Redis", "并发"));
        dto.setContentMd("# 标题\n\n把 Redis ZSet 分片写清楚，共 16 个字左右。");
        dto.setStatus(0);
        return dto;
    }

    @Test
    void savePersistsArticleContentTagsAndAuditLog() {
        createdId = adminArticleService.saveArticle(saveDto("admin-save-probe"), 1L, "127.0.0.1", "JUnit");

        assertThat(articleMapper.selectById(createdId).getStatus()).isZero();
        ArticleContentDO content = articleContentMapper.selectById(createdId);
        assertThat(content.getContentMd()).contains("Redis ZSet");
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(createdId))).hasSize(2);
        assertThat(articleMapper.selectById(createdId).getWordCount()).isGreaterThan(0);
        assertThat(articleMapper.selectById(createdId).getReadingMinutes()).isGreaterThanOrEqualTo(1);

        Integer audits = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE target_id = ? AND action = ?",
                Integer.class, createdId, AuditActionConstant.CREATE);
        assertThat(audits).isEqualTo(1);
    }

    @Test
    void duplicateSlugIsRejectedWithConflictCode() {
        createdId = adminArticleService.saveArticle(saveDto("admin-slug-conflict"), 1L, "127.0.0.1", "JUnit");

        assertThatThrownBy(() -> adminArticleService.saveArticle(saveDto("admin-slug-conflict"), 1L, "127.0.0.1", "JUnit"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCodeEnum.SLUG_CONFLICT.getCode());
    }

    @Test
    void updateRecalculatesWordCount() {
        createdId = adminArticleService.saveArticle(saveDto("admin-update-probe"), 1L, "127.0.0.1", "JUnit");
        int before = articleMapper.selectById(createdId).getWordCount();

        ArticleUpdateDTO update = new ArticleUpdateDTO();
        update.setId(createdId);
        update.setTitle("改过的标题");
        update.setSlug("admin-update-probe");
        update.setCategoryId(2L);
        update.setTags(List.of("MySQL"));
        update.setContentMd("短了。");
        update.setStatus(0);
        adminArticleService.updateArticle(update, 1L, "127.0.0.1", "JUnit");

        assertThat(articleMapper.selectById(createdId).getWordCount()).isLessThan(before);
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(createdId))).hasSize(1);
    }

    @Test
    void publishSetsPublishTimeAndUnpublishKeepsIt() {
        createdId = adminArticleService.saveArticle(saveDto("admin-publish-probe"), 1L, "127.0.0.1", "JUnit");

        adminArticleService.updateStatus(createdId, 1, 1L, "127.0.0.1", "JUnit");
        var published = articleMapper.selectById(createdId);
        assertThat(published.getStatus()).isEqualTo(1);
        assertThat(published.getPublishTime()).isNotNull();
        var publishTime = published.getPublishTime();

        adminArticleService.updateStatus(createdId, 0, 1L, "127.0.0.1", "JUnit");
        var unpublished = articleMapper.selectById(createdId);
        assertThat(unpublished.getStatus()).isZero();
        assertThat(unpublished.getPublishTime()).isEqualTo(publishTime);   // 撤回不动 publish_time
    }

    @Test
    void removeDeletesContentAndTagRelations() {
        createdId = adminArticleService.saveArticle(saveDto("admin-remove-probe"), 1L, "127.0.0.1", "JUnit");
        Long id = createdId;
        createdId = null;

        adminArticleService.removeArticle(id, 1L, "127.0.0.1", "JUnit");

        assertThat(articleMapper.selectById(id)).isNull();
        assertThat(articleContentMapper.selectById(id)).isNull();
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(id))).isEmpty();
    }
}
```

- [ ] **Step 3: 跑测试确认失败**：`mvn -q test -Dtest=AdminArticleServiceTest` → 编译失败
- [ ] **Step 3b: 写服务接口**（Controller 只依赖接口 —— ArchUnit 规则 4）

```java
package com.jcpress.service;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;

public interface AdminArticleService {

    PageResult<AdminArticleVO> listForAdmin(AdminArticleQuery query);

    AdminArticleVO getForAdmin(Long id);

    Long saveArticle(ArticleSaveDTO dto, Long adminId, String ip, String userAgent);

    void updateArticle(ArticleUpdateDTO dto, Long adminId, String ip, String userAgent);

    void updateStatus(Long id, Integer status, Long adminId, String ip, String userAgent);

    void removeArticle(Long id, Long adminId, String ip, String userAgent);
}
```

- [ ] **Step 4: 写实现**（关键点：**预检 + 捕获 `DuplicateKeyException` 双保险**；标签「解析或创建」；审计同事务）

```java
package com.jcpress.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.result.PageResult;
import com.jcpress.common.util.SlugUtils;
import com.jcpress.common.util.WordCountUtils;
import com.jcpress.domain.converter.ArticleConverter;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.ArticleTagDO;
import com.jcpress.domain.dataobject.TagDO;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.repository.*;
import com.jcpress.service.AdminArticleService;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminArticleServiceImpl implements AdminArticleService {

    private static final String TYPE_TECH = "TECH";
    private static final DateTimeFormatter SLUG_SUFFIX = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final ArticleTagMapper articleTagMapper;
    private final TagMapper tagMapper;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public Long saveArticle(ArticleSaveDTO dto, Long adminId, String ip, String userAgent) {
        String slug = resolveSlug(dto.getSlug(), dto.getTitle());
        if (articleMapper.getByTypeAndSlug(TYPE_TECH, slug) != null) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleDO article = new ArticleDO();
        applyCommonFields(article, dto.getTitle(), slug, dto.getSummary(), dto.getCoverUrl(),
                dto.getCategoryId(), dto.getContentMd());
        article.setType(TYPE_TECH);
        article.setStatus(dto.getStatus() == null ? 0 : dto.getStatus());
        article.setLikeCount(0);
        article.setViewCount(0);
        article.setTop(0);
        if (article.getStatus() == 1) {
            article.setPublishTime(LocalDateTime.now());
        }
        try {
            articleMapper.insert(article);
        } catch (DuplicateKeyException e) {
            // uk_type_slug 是权威判据：预检只是为了让用户早点看到 40901
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(article.getId());
        content.setContentMd(dto.getContentMd());
        articleContentMapper.insert(content);

        updateTags(article.getId(), dto.getTags());
        saveAudit(adminId, AuditActionConstant.CREATE, article.getId(), "新建文章 " + slug, ip, userAgent);
        return article.getId();
    }

    @Override
    @Transactional
    public void updateArticle(ArticleUpdateDTO dto, Long adminId, String ip, String userAgent) {
        ArticleDO existing = articleMapper.selectById(dto.getId());
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        String slug = resolveSlug(dto.getSlug(), dto.getTitle());
        ArticleDO sameSlug = articleMapper.getByTypeAndSlug(TYPE_TECH, slug);
        if (sameSlug != null && !sameSlug.getId().equals(dto.getId())) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleDO article = new ArticleDO();
        article.setId(dto.getId());
        applyCommonFields(article, dto.getTitle(), slug, dto.getSummary(), dto.getCoverUrl(),
                dto.getCategoryId(), dto.getContentMd());
        try {
            articleMapper.updateById(article);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(dto.getId());
        content.setContentMd(dto.getContentMd());
        if (articleContentMapper.selectById(dto.getId()) == null) {
            articleContentMapper.insert(content);
        } else {
            articleContentMapper.updateById(content);
        }
        updateTags(dto.getId(), dto.getTags());
        saveAudit(adminId, AuditActionConstant.UPDATE, dto.getId(), "更新文章 " + slug, ip, userAgent);
    }

    @Override
    @Transactional
    public void updateStatus(Long id, Integer status, Long adminId, String ip, String userAgent) {
        ArticleDO existing = articleMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        if (status == null || (status != 0 && status != 1 && status != 2)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "status 只允许 0/1/2");
        }
        ArticleDO article = new ArticleDO();
        article.setId(id);
        article.setStatus(status);
        if (status == 1 && existing.getPublishTime() == null) {
            article.setPublishTime(LocalDateTime.now());
        }
        articleMapper.updateById(article);
        saveAudit(adminId, AuditActionConstant.PUBLISH, id,
                "状态 " + existing.getStatus() + " → " + status, ip, userAgent);
    }

    @Override
    @Transactional
    public void removeArticle(Long id, Long adminId, String ip, String userAgent) {
        ArticleDO existing = articleMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        // 逻辑外键在应用层解决：先删从表再删主表（规划 §6.6）
        articleTagMapper.deleteByArticleId(id);
        articleContentMapper.deleteById(id);
        articleMapper.deleteById(id);
        saveAudit(adminId, AuditActionConstant.DELETE, id, "删除文章 " + existing.getSlug(), ip, userAgent);
    }

    @Override
    public PageResult<AdminArticleVO> listForAdmin(AdminArticleQuery query) {
        Page<ArticleDO> page = new Page<>(query.normalizedPage(), query.normalizedSize());
        Page<ArticleDO> result = articleMapper.listForAdmin(page, query);

        List<Long> ids = result.getRecords().stream().map(ArticleDO::getId).toList();
        Map<Long, List<TagVO>> tagGroups = ids.isEmpty()
                ? Map.of()
                : ArticleConverter.groupTags(articleTagMapper.listTagRefsByArticleIds(ids));

        List<AdminArticleVO> list = result.getRecords().stream()
                .map(article -> toAdminVO(article, tagGroups.getOrDefault(article.getId(), List.of()), null))
                .toList();
        return PageResult.of(list, result.getCurrent(), result.getSize(), result.getTotal());
    }

    @Override
    public AdminArticleVO getForAdmin(Long id) {
        ArticleDO article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        ArticleContentDO content = articleContentMapper.selectById(id);
        List<TagVO> tags = ArticleConverter.toTagVOs(
                articleTagMapper.listTagRefsByArticleIds(List.of(id)), id);
        return toAdminVO(article, tags, content == null ? "" : content.getContentMd());
    }

    /** 后台 VO：标签只下发名字（编辑器直接用），status/gmtModified 这类内部字段只在这里出现 */
    private AdminArticleVO toAdminVO(ArticleDO article, List<TagVO> tags, String contentMd) {
        AdminArticleVO vo = new AdminArticleVO();
        vo.setId(article.getId());
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setSummary(article.getSummary());
        vo.setCategoryId(article.getCategoryId());
        vo.setCategoryName(article.getCategoryName());
        vo.setTags(tags.stream().map(TagVO::getName).toList());
        vo.setStatus(article.getStatus());
        vo.setWordCount(article.getWordCount());
        vo.setReadingMinutes(article.getReadingMinutes());
        vo.setViewCount(article.getViewCount());
        vo.setTop(article.getTop());
        vo.setPublishTime(article.getPublishTime());
        vo.setGmtModified(article.getGmtModified());
        vo.setContentMd(contentMd);
        return vo;
    }

    private void applyCommonFields(ArticleDO article, String title, String slug, String summary,
                                   String coverUrl, Long categoryId, String contentMd) {
        int wordCount = WordCountUtils.count(contentMd);
        article.setTitle(title);
        article.setSlug(slug);
        article.setSummary(summary);
        article.setCoverUrl(coverUrl);
        article.setCategoryId(categoryId);
        article.setWordCount(wordCount);
        article.setReadingMinutes(WordCountUtils.estimateReadingMinutes(wordCount));
    }

    private String resolveSlug(String rawSlug, String title) {
        String slug = (rawSlug == null || rawSlug.isBlank()) ? SlugUtils.normalize(title) : rawSlug.trim();
        if (slug == null) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "标题无法自动生成 slug，请手动填写");
        }
        if (!SlugUtils.isValid(slug)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR,
                    "slug 只能是小写字母/数字/连字符，长度 3–120");
        }
        return slug;
    }

    private void updateTags(Long articleId, List<String> tagNames) {
        articleTagMapper.deleteByArticleId(articleId);
        if (tagNames == null || tagNames.isEmpty()) {
            return;
        }
        tagNames.stream().distinct().limit(6).forEach(name -> {
            String slug = SlugUtils.normalize(name);
            if (slug == null) {
                return;
            }
            TagDO tag = tagMapper.getBySlug(slug);
            if (tag == null) {
                tag = new TagDO();
                tag.setName(name);
                tag.setSlug(slug);
                try {
                    tagMapper.insert(tag);
                } catch (DuplicateKeyException e) {
                    tag = tagMapper.getBySlug(slug);   // 并发下别人刚插进去
                }
            }
            ArticleTagDO relation = new ArticleTagDO();
            relation.setArticleId(articleId);
            relation.setTagId(tag.getId());
            articleTagMapper.insert(relation);
        });
    }

    private void saveAudit(Long adminId, String action, Long targetId, String detail, String ip, String userAgent) {
        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(action);
        audit.setTargetType(AdminConstant.TARGET_TYPE_ARTICLE);
        audit.setTargetId(targetId);
        audit.setDetail(detail);
        audit.setIp(ip);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);
    }
}
```

- [ ] **Step 5: 补 Mapper 方法**

| Mapper | 新增方法 | SQL |
| --- | --- | --- |
| `ArticleMapper` | `getByTypeAndSlug(@Param("type") String type, @Param("slug") String slug)` | 与 `getPublishedBySlug` 同，但**不带 `status` 条件**（后台要看草稿） |
| `ArticleMapper` | `listForAdmin(Page<ArticleDO> page, @Param("query") AdminArticleQuery query)` | 见 Task 7 Step 1 的 XML |
| `TagMapper` | `getBySlug(@Param("slug") String slug)` | `SELECT id, name, slug, gmt_create, gmt_modified FROM tag WHERE slug = #{slug} LIMIT 1` |
| `CategoryMapper` | `getByScopeAndSlug(@Param("scope") String scope, @Param("slug") String slug)` | `SELECT id, scope, parent_id, name, slug, description, sort, gmt_create, gmt_modified FROM category WHERE scope = #{scope} AND slug = #{slug} LIMIT 1`（导入器用它把 front-matter 里的 `category: java-backend` 解析成 `category_id`） |

- [ ] **Step 6: 跑测试**：`mvn -q test -Dtest=AdminArticleServiceTest` → PASS（5 个用例）
- [ ] **Step 7: Commit**：`git commit -m "feat(backend): 后台文章写服务（增/改/删/发布撤回 + 标签解析或创建 + 审计同事务）"`

---

## 7. Task 7: 后台文章列表与控制器

**Files:**
- Create: `backend/src/main/java/com/jcpress/web/admin/controller/AdminArticleController.java`
- Modify: `backend/src/main/java/com/jcpress/repository/ArticleMapper.java` + XML（后台列表）
- Test: `backend/src/test/java/com/jcpress/web/admin/AdminArticleControllerTest.java`

- [ ] **Step 1: 补后台列表 SQL**（`keyword` 主路径走 ngram 全文索引，**< 2 字回退 `LIKE 'kw%'`** —— 因为 `ngram_token_size=2` 时单字在全文索引里命中 0）

```xml
    <select id="listForAdmin" resultType="com.jcpress.domain.dataobject.ArticleDO">
        SELECT <include refid="cardColumns"/>, c.name AS category_name, c.slug AS category_slug
        FROM article a
        LEFT JOIN category c ON c.id = a.category_id
        WHERE a.type = #{query.type}
        <if test="query.status != null">
            AND a.status = #{query.status}
        </if>
        <if test="query.categoryId != null">
            AND a.category_id = #{query.categoryId}
        </if>
        <if test="query.keyword != null and query.keyword != ''">
            <choose>
                <when test="query.keyword.length() &gt;= 2">
                    AND MATCH(a.title, a.summary) AGAINST(CONCAT(#{query.keyword}, '*') IN BOOLEAN MODE)
                </when>
                <otherwise>
                    AND a.title LIKE CONCAT(#{query.keyword}, '%')
                </otherwise>
            </choose>
        </if>
        ORDER BY a.gmt_modified DESC
    </select>
```

- [ ] **Step 2: 写 Controller**（全部 GET/POST；状态迁移用路径后缀）

```java
package com.jcpress.web.admin.controller;

import com.jcpress.common.result.PageResult;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;
import com.jcpress.service.AdminArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/admin/articles")
@RequiredArgsConstructor
@Tag(name = "后台文章管理")
public class AdminArticleController {

    private final AdminArticleService adminArticleService;

    @GetMapping
    @Operation(summary = "内容列表（含草稿）")
    public Result<PageResult<AdminArticleVO>> list(AdminArticleQuery query) {
        return Result.success(adminArticleService.listForAdmin(query));
    }

    @GetMapping("/{id}")
    @Operation(summary = "编辑用详情（含正文）")
    public Result<AdminArticleVO> detail(@PathVariable Long id) {
        return Result.success(adminArticleService.getForAdmin(id));
    }

    @PostMapping
    @Operation(summary = "新建文章")
    public Result<String> save(@RequestBody @Valid ArticleSaveDTO dto, HttpServletRequest request) {
        Long id = adminArticleService.saveArticle(dto, currentAdminId(), IpUtils.getClientIp(request),
                request.getHeader("User-Agent"));
        return Result.success(String.valueOf(id));
    }

    @PostMapping("/{id}")
    @Operation(summary = "更新文章")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid ArticleUpdateDTO dto,
                               HttpServletRequest request) {
        dto.setId(id);
        adminArticleService.updateArticle(dto, currentAdminId(), IpUtils.getClientIp(request),
                request.getHeader("User-Agent"));
        return Result.success();
    }

    @PostMapping("/{id}/publish")
    @Operation(summary = "发布 / 撤回（status: 1 发布，0 撤回）")
    public Result<Void> publish(@PathVariable Long id, @RequestParam Integer status, HttpServletRequest request) {
        adminArticleService.updateStatus(id, status, currentAdminId(), IpUtils.getClientIp(request),
                request.getHeader("User-Agent"));
        return Result.success();
    }

    @PostMapping("/{id}/delete")
    @Operation(summary = "删除文章")
    public Result<Void> remove(@PathVariable Long id, HttpServletRequest request) {
        adminArticleService.removeArticle(id, currentAdminId(), IpUtils.getClientIp(request),
                request.getHeader("User-Agent"));
        return Result.success();
    }

    private Long currentAdminId() {
        return cn.dev33.satoken.stp.StpUtil.getLoginIdAsLong();
    }
}
```

- [ ] **Step 3: 写测试**（真实链路：未登录 401、登录后列表含草稿、新建→发布→公开列表可见）

```java
package com.jcpress.web.admin;

import com.google.gson.Gson;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.infrastructure.config.GsonConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminArticleControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    private final Gson gson = GsonConfig.buildGson();
    private String token;

    @BeforeEach
    void login() throws Exception {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername("admin");
        dto.setPassword("jcpress@2026");
        MvcResult result = mockMvc.perform(post("/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(dto)))
                .andExpect(status().isOk()).andReturn();
        token = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.token");
    }

    @Test
    void listWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/v1/admin/articles")).andExpect(status().isUnauthorized());
    }

    @Test
    void listWithTokenIncludesDrafts() throws Exception {
        mockMvc.perform(get("/v1/admin/articles").header("jcpress-token", token).param("status", "0"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(0)))
               .andExpect(jsonPath("$.data.list[0].status").value(0));
    }

    @Test
    void createPublishThenItAppearsInPublicList() throws Exception {
        ArticleSaveDTO dto = new ArticleSaveDTO();
        dto.setTitle("接口链路验证文");
        dto.setSlug("controller-chain-probe");
        dto.setCategoryId(2L);
        dto.setTags(List.of("Redis"));
        dto.setContentMd("# 标题\n\n正文。");
        dto.setStatus(0);

        MvcResult created = mockMvc.perform(post("/v1/admin/articles")
                        .header("jcpress-token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(dto)))
                .andExpect(status().isOk()).andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(created.getResponse().getContentAsString(), "$.data");

        try {
            mockMvc.perform(post("/v1/admin/articles/" + id + "/publish")
                            .header("jcpress-token", token).param("status", "1"))
                   .andExpect(status().isOk());

            mockMvc.perform(get("/v1/articles/controller-chain-probe"))
                   .andExpect(status().isOk())
                   .andExpect(jsonPath("$.data.slug").value("controller-chain-probe"));
        } finally {
            mockMvc.perform(post("/v1/admin/articles/" + id + "/delete").header("jcpress-token", token));
        }
    }
}
```

- [ ] **Step 4: 跑测试**：`mvn -q test -Dtest=AdminArticleControllerTest` → PASS（3 个用例）
- [ ] **Step 5: Commit**：`git commit -m "feat(backend): 后台文章接口（列表含草稿、新建、更新、发布撤回、删除）"`

---

## 8. Task 8: W5 Markdown 导入器（CLI，幂等 + dry-run + 整批回滚）

**Files:**
- Create: `backend/src/main/java/com/jcpress/importer/{FrontMatter,FrontMatterParser,ImportReport,ImportItem,MarkdownImporter,ImportRunner}.java`
- Create: `backend/src/main/resources/application-importer.yml`
- Create: `content/tech/phase-3-backend-retro.md`（**仓库内的 Markdown 源**，与 §10.3 的 front-matter 约定一致）
- Test: `backend/src/test/java/com/jcpress/importer/MarkdownImporterTest.java`

- [ ] **Step 1: 写 front-matter 解析**（用 Spring Boot 自带的 SnakeYAML，**不新增依赖**）

```java
package com.jcpress.importer;

import lombok.Data;

import java.util.List;

@Data
public class FrontMatter {

    private String title;
    private String slug;
    private String type = "TECH";
    private String category;
    private List<String> tags = List.of();
    private String summary;
    private String cover;
    /** DRAFT / PUBLISHED / ARCHIVED */
    private String status = "DRAFT";
    private String publishTime;
}
```

```java
package com.jcpress.importer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class FrontMatterParser {

    private static final String DELIMITER = "---";

    public ParsedMarkdown parse(String raw, String fileName) {
        String normalized = raw.replace("\r\n", "\n");
        if (!normalized.startsWith(DELIMITER)) {
            throw new ImportException(fileName + "：缺少 front-matter（文件必须以 --- 开头）");
        }
        int end = normalized.indexOf("\n" + DELIMITER, DELIMITER.length());
        if (end < 0) {
            throw new ImportException(fileName + "：front-matter 没有结束的 ---");
        }
        String yamlBlock = normalized.substring(DELIMITER.length(), end);
        String body = normalized.substring(end + DELIMITER.length() + 1).stripLeading();

        Map<String, Object> map = new Yaml().load(yamlBlock);
        if (map == null) {
            throw new ImportException(fileName + "：front-matter 为空");
        }
        FrontMatter frontMatter = new FrontMatter();
        frontMatter.setTitle(asString(map.get("title")));
        frontMatter.setSlug(asString(map.get("slug")));
        frontMatter.setType(map.get("type") == null ? "TECH" : asString(map.get("type")));
        frontMatter.setCategory(asString(map.get("category")));
        frontMatter.setSummary(asString(map.get("summary")));
        frontMatter.setCover(asString(map.get("cover")));
        frontMatter.setStatus(map.get("status") == null ? "DRAFT" : asString(map.get("status")));
        frontMatter.setPublishTime(asString(map.get("publishTime")));
        Object tags = map.get("tags");
        if (tags instanceof List<?> list) {
            frontMatter.setTags(list.stream().map(String::valueOf).toList());
        }
        validate(frontMatter, fileName);
        return new ParsedMarkdown(frontMatter, body);
    }

    private void validate(FrontMatter frontMatter, String fileName) {
        if (frontMatter.getTitle() == null || frontMatter.getTitle().isBlank()) {
            throw new ImportException(fileName + "：title 必填");
        }
        if (frontMatter.getSlug() == null || !com.jcpress.common.util.SlugUtils.isValid(frontMatter.getSlug())) {
            throw new ImportException(fileName + "：slug 缺失或格式不合法（小写字母/数字/连字符，3–120）");
        }
        if (frontMatter.getCategory() == null || frontMatter.getCategory().isBlank()) {
            throw new ImportException(fileName + "：category 必填（TECH/ALGO 类型）");
        }
        if (!List.of("DRAFT", "PUBLISHED", "ARCHIVED").contains(frontMatter.getStatus())) {
            throw new ImportException(fileName + "：status 只允许 DRAFT/PUBLISHED/ARCHIVED");
        }
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    public record ParsedMarkdown(FrontMatter frontMatter, String body) {
    }
}
```

```java
package com.jcpress.importer;

/** 导入期的输入问题：整批回滚，不写库 */
public class ImportException extends RuntimeException {

    public ImportException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: 写 `MarkdownImporter`**（**两段式**：先全量解析校验，再单事务落库 → 天然满足「校验失败整批回滚」；`dry-run` 只到第一段）

```java
package com.jcpress.importer;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.util.SlugUtils;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.CategoryDO;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.CategoryMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class MarkdownImporter {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final FrontMatterParser parser;
    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final CategoryMapper categoryMapper;

    /** 第一段：只读、只解析、只校验 —— 任何一个文件不合法都在这里抛出，不会写库 */
    public List<ImportItem> prepare(Path directory) throws IOException {
        List<Path> files;
        try (var stream = Files.walk(directory)) {
            files = stream.filter(path -> path.toString().endsWith(".md"))
                    .sorted(Comparator.comparing(Path::toString))
                    .toList();
        }
        if (files.isEmpty()) {
            throw new ImportException("目录下没有 .md 文件：" + directory);
        }
        List<ImportItem> items = new ArrayList<>();
        for (Path file : files) {
            String raw = Files.readString(file, StandardCharsets.UTF_8);
            FrontMatterParser.ParsedMarkdown parsed = parser.parse(raw, file.getFileName().toString());
            Long categoryId = resolveCategoryId(parsed.frontMatter().getCategory(), file);
            ArticleDO existing = articleMapper.getByTypeAndSlug(parsed.frontMatter().getType(),
                    parsed.frontMatter().getSlug());
            items.add(new ImportItem(file, parsed.frontMatter(), parsed.body(), categoryId, existing));
        }
        return items;
    }

    /** 第二段：单事务落库；不删除任何内容 */
    @Transactional
    public ImportReport importItems(List<ImportItem> items) {
        int created = 0;
        int updated = 0;
        for (ImportItem item : items) {
            ArticleDO article = new ArticleDO();
            article.setType(item.frontMatter().getType());
            article.setTitle(item.frontMatter().getTitle());
            article.setSlug(item.frontMatter().getSlug());
            article.setSummary(item.frontMatter().getSummary());
            article.setCoverUrl(item.frontMatter().getCover());
            article.setCategoryId(item.categoryId());
            int wordCount = com.jcpress.common.util.WordCountUtils.count(item.body());
            article.setWordCount(wordCount);
            article.setReadingMinutes(com.jcpress.common.util.WordCountUtils.estimateReadingMinutes(wordCount));
            article.setStatus(mapStatus(item.frontMatter().getStatus()));

            if (item.existing() == null) {
                article.setViewCount(0);
                article.setLikeCount(0);
                article.setTop(0);
                // 已发布但 front-matter 没给时间时兜底成 now()：
                // 公开列表要求 publish_time IS NOT NULL，否则这篇会"发布了但看不见"
                LocalDateTime publishTime = parseTime(item.frontMatter());
                article.setPublishTime(article.getStatus() == 1
                        ? (publishTime == null ? LocalDateTime.now() : publishTime)
                        : publishTime);
                articleMapper.insert(article);

                ArticleContentDO content = new ArticleContentDO();
                content.setArticleId(article.getId());
                content.setContentMd(item.body());
                articleContentMapper.insert(content);
                created++;
            } else {
                article.setId(item.existing().getId());
                if (article.getStatus() == 1 && item.existing().getPublishTime() == null) {
                    article.setPublishTime(parseTime(item.frontMatter()) == null
                            ? LocalDateTime.now() : parseTime(item.frontMatter()));
                }
                articleMapper.updateById(article);

                ArticleContentDO content = new ArticleContentDO();
                content.setArticleId(item.existing().getId());
                content.setContentMd(item.body());
                if (articleContentMapper.selectById(item.existing().getId()) == null) {
                    articleContentMapper.insert(content);
                } else {
                    articleContentMapper.updateById(content);
                }
                updated++;
            }
        }
        return new ImportReport(created, updated, 0, List.of());
    }

    private Long resolveCategoryId(String categorySlug, Path file) {
        CategoryDO category = categoryMapper.getByScopeAndSlug("TECH", categorySlug);
        if (category == null) {
            throw new ImportException(file.getFileName() + "：分类不存在 category=" + categorySlug);
        }
        return category.getId();
    }

    private int mapStatus(String status) {
        return switch (status) {
            case "PUBLISHED" -> 1;
            case "ARCHIVED" -> 2;
            default -> 0;
        };
    }

    private LocalDateTime parseTime(FrontMatter frontMatter) {
        if (frontMatter.getPublishTime() == null || frontMatter.getPublishTime().isBlank()) {
            return null;
        }
        return LocalDateTime.parse(frontMatter.getPublishTime(), TIME);
    }
}
```

- [ ] **Step 3: 写 `ImportItem` / `ImportReport` / `ImportRunner`**

```java
package com.jcpress.importer;

import com.jcpress.domain.dataobject.ArticleDO;

import java.nio.file.Path;

public record ImportItem(Path file, FrontMatter frontMatter, String body, Long categoryId, ArticleDO existing) {

    public String action() {
        return existing == null ? "新增" : "更新";
    }
}
```

```java
package com.jcpress.importer;

import java.util.List;

public record ImportReport(int created, int updated, int skipped, List<String> failures) {

    public String render() {
        StringBuilder builder = new StringBuilder();
        builder.append("新增 ").append(created).append(" 篇 / 更新 ").append(updated)
                .append(" 篇 / 跳过 ").append(skipped).append(" 篇 / 失败 ").append(failures.size()).append(" 篇");
        for (String failure : failures) {
            builder.append("\n  ✗ ").append(failure);
        }
        return builder.toString();
    }
}
```

```java
package com.jcpress.importer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.List;

/** 不暴露 HTTP：只有带 --import=<dir> 才干活，其余情况静默退出 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ImportRunner implements ApplicationRunner {

    public static final String ARG_IMPORT = "import";
    public static final String ARG_DRY_RUN = "dry-run";

    private final MarkdownImporter markdownImporter;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!args.containsOption(ARG_IMPORT)) {
            return;
        }
        List<String> values = args.getOptionValues(ARG_IMPORT);
        if (values == null || values.isEmpty()) {
            throw new ImportException("--import 需要给定目录");
        }
        Path directory = Path.of(values.get(0));
        List<ImportItem> items = markdownImporter.prepare(directory);
        boolean dryRun = args.containsOption(ARG_DRY_RUN);

        if (dryRun) {
            System.out.println("[dry-run] 将处理 " + items.size() + " 个文件：");
            items.forEach(item -> System.out.printf("  %s  %s  (%s)%n",
                    item.action(), item.frontMatter().getSlug(), item.file().getFileName()));
            System.out.println("[dry-run] 未写库。");
            return;
        }
        ImportReport report = markdownImporter.importItems(items);
        System.out.println(report.render());
    }
}
```

- [ ] **Step 4: 写 `application-importer.yml`**（CLI 模式不启 Web 容器、不改数据库结构）

```yaml
spring:
  main:
    web-application-type: none
  flyway:
    enabled: true
logging:
  level:
    root: warn
    com.jcpress: info
```

- [ ] **Step 5: 写仓库内的 Markdown 源** `content/tech/phase-3-backend-retro.md`

```markdown
---
title: 三期后端复盘：把官方模板升到 Spring Boot 3 踩到的五个坑
slug: phase-3-backend-retro
type: TECH
category: java-backend
tags: [Spring Boot, MyBatis-Plus, Redis]
summary: 从 SB 2.7.2 升 3.3.4、Jackson 换 Gson、Sa-Token 版本被本机 Redis 卡住……
status: PUBLISHED
publishTime: 2026-10-02 09:00:00
---

（正文与 W2 Task 7 的 seed 内容一致，见该任务的 Step 2b 提纲）
```

- [ ] **Step 6: 写导入器测试**（5 条：新增、幂等更新、dry-run 不写库、分类不存在报错、**坏文件导致整批回滚**）

```java
package com.jcpress.importer;

import com.jcpress.repository.ArticleMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class MarkdownImporterTest {

    @Autowired MarkdownImporter markdownImporter;
    @Autowired ArticleMapper articleMapper;

    @TempDir Path tempDir;

    private Path write(String name, String content) throws IOException {
        Path file = tempDir.resolve(name);
        Files.writeString(file, content, StandardCharsets.UTF_8);
        return file;
    }

    private String doc(String slug, String category) {
        return """
                ---
                title: 导入器测试文 %s
                slug: %s
                type: TECH
                category: %s
                tags: [Redis]
                status: DRAFT
                ---

                # 标题

                正文用于验证幂等导入。
                """.formatted(slug, slug, category);
    }

    @Test
    void firstImportCreatesThenSecondImportUpdates() throws Exception {
        write("a.md", doc("importer-probe-a", "java-backend"));
        try {
            List<ImportItem> items = markdownImporter.prepare(tempDir);
            ImportReport first = markdownImporter.importItems(items);
            assertThat(first.created()).isEqualTo(1);
            assertThat(first.updated()).isZero();

            ImportReport second = markdownImporter.importItems(markdownImporter.prepare(tempDir));
            assertThat(second.created()).isZero();
            assertThat(second.updated()).isEqualTo(1);
        } finally {
            var existing = articleMapper.getByTypeAndSlug("TECH", "importer-probe-a");
            if (existing != null) {
                articleMapper.deleteById(existing.getId());
            }
        }
    }

    @Test
    void badCategoryFailsBeforeAnythingIsWritten() throws Exception {
        write("good.md", doc("importer-probe-good", "java-backend"));
        write("bad.md", doc("importer-probe-bad", "no-such-category"));

        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("分类不存在");
        // 第一段就抛了，第二个文件不会写进去（整批回滚）
        assertThat(articleMapper.getByTypeAndSlug("TECH", "importer-probe-good")).isNull();
    }

    @Test
    void missingFrontMatterIsRejectedWithFileName() throws Exception {
        write("plain.md", "# 没有 front-matter\n");
        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("plain.md");
    }

    @Test
    void emptyDirectoryIsRejected() {
        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("没有 .md 文件");
    }
}
```

- [ ] **Step 7: 跑测试**：`mvn -q test -Dtest=MarkdownImporterTest` → PASS（4 个用例）
- [ ] **Step 8: 手动跑一次 dry-run 与真导入**

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
mvn -q -DskipTests package
java -jar target/jcpress-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=importer --import=../content/tech --dry-run
java -jar target/jcpress-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=importer --import=../content/tech
```

Expected：dry-run 打印「将处理 1 个文件 / 更新 phase-3-backend-retro」且不写库；真导入打印「新增 0 篇 / 更新 1 篇」

- [ ] **Step 9: Commit**：`git commit -m "feat(backend): Markdown 导入器 CLI（front-matter 校验、按 (type,slug) 幂等、dry-run、整批回滚）"`

---

## 9. Task 9: W3+W5 出口复核与留痕

- [ ] **Step 1: 过验收门**：`mvn -q -DskipTests compile` → `mvn -q test`（全量，含 W1/W2 的卡口）
- [ ] **Step 2: 手工走一遍后台全链路**（用真 token）

```powershell
$login = Invoke-RestMethod -Method Post 'http://127.0.0.1:8080/api/v1/admin/auth/login' `
  -ContentType 'application/json' -Body '{"username":"admin","password":"jcpress@2026"}'
$token = $login.data.token
$h = @{ 'jcpress-token' = $token }
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/admin/articles?status=0' -Headers $h | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post 'http://127.0.0.1:8080/api/v1/admin/articles/1' -Headers $h `
  -ContentType 'application/json' -Body '{"title":"改标题","slug":"phase-3-backend-retro","categoryId":2,"tags":["Redis"],"contentMd":"# 改过的正文","status":1}'
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/articles?type=TECH' | ConvertTo-Json -Depth 5
```

Expected：列表含 5 篇草稿 + 1 篇已发布；更新成功；公开列表仍只看到已发布 · 审计表里能看到 LOGIN/CREATE/UPDATE 记录

- [ ] **Step 3: 查审计与失败锁定是否真的落库**

```sql
SELECT action, target_type, target_id, LEFT(detail, 40) AS detail, ip, gmt_create
FROM admin_audit_log ORDER BY id DESC LIMIT 10;
```

- [ ] **Step 4: 留痕**：`docs/dev-journal.md` 追加「阶段 34 · W3 + W5」四样（含 **slug 无法从中文标题生成** 这条纠偏，以及导入器的实测输出）
- [ ] **Step 5: Commit**：`git commit -m "docs(phase-3): W3 + W5 完成留痕"`
