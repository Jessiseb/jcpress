# 技术分享模块（三期）实施计划 · 索引 与 W1 后端骨架

> **给执行者（本会话的 agent）**：本环境**未安装** `superpowers:subagent-driven-development` / `superpowers:executing-plans`（已核实 `~/.agents/skills` 与项目 `.agents/skills` 下都没有这两个技能），因此执行方式定为**本会话内联逐任务执行、每个任务结束后复核并 commit**，用下面的 `- [ ]` 复选框跟踪进度。
>
> **配套文档**：[设计定稿](design-tech-module.md)（已批准）· [开发日志](dev-journal.md) · [决策记录](decisions.md) · [验收评估集](phase3-effect-matrix.md)（W4 建）

**Goal**：让「技术分享」端到端可用 —— 后台能增/改/删/发布文章，前台能从首页与 `/tech` 点进文章详情并以护眼排版阅读。

**Architecture**：后端从官方模板 `springboot-init` 移植骨架、升级到 Spring Boot 3.3.4 / Java 17，按规划 §11.4 落 `com.jcpress` 分层（portal / admin 物理隔离），统一响应体 + Gson + Sa-Token + Flyway；前台把 `useArticles()` 的 mock 换成 TanStack Query，新增 `/tech/:slug` 详情页与首页区块，Markdown 渲染与高亮全部路由级懒加载。

**Tech Stack**：Java 17 · Spring Boot 3.3.4 · MyBatis-Plus 3.5.7 · Gson · Sa-Token 1.44.0 · Flyway · MySQL 8.0.36 · Redis 5.0.14 · React 18 + Vite 6 + TanStack Query + react-markdown + CodeMirror 6

---

## 0. 计划的组织方式（含一处对技能的适配）

拆成 **4 个文件**，一个工作流一个 —— 每个文件单独看都能产出「可运行、可测」的软件：

| 文件 | 范围 | 状态 |
| --- | --- | --- |
| **本文件** | 索引 + **W1 后端骨架与规约卡口** | ✅ 1471 行 / 9 任务 / 50 步 |
| `docs/plan-tech-module-w2-domain.md` | W2 技术分享领域 + 公开接口 | ✅ 1442 行 / 8 任务 / 48 步 |
| `docs/plan-tech-module-w3-admin-importer.md` | W3 后台写平面（登录/增改删/发布/上传/审计）**+ W5 Markdown 导入器 CLI** | ✅ 2422 行 / 9 任务 / 57 步 |
| `docs/plan-tech-module-w4-frontend.md` | W4 前台三页 + 后台写入口 UI + 视觉改版 | ✅ 1706 行 / 10 任务 / 65 步 |

**合计：36 个任务 / 220 个可执行步骤。** 每个工作流都以「过验收门 + 追加 dev-journal 留痕 + commit」收口。

**对技能的一处适配（如实记录）**：writing-plans 要求「每个改代码的步骤都给出完整代码」。本计划对**含逻辑的部分**（配置、Gson 适配器、异常映射、SQL、ArchUnit 规则、Service 逻辑、测试、React 组件）给出可直接落盘的真实代码；对**无逻辑样板**（DO/DTO/VO 这类纯字段类，本期约 20 个）不逐行重复，改为「**1 个完整示例 + 逐字段表**（字段名 / 类型 / 注解）」。理由：样板逐行抄会把计划膨胀到数千行而信息量不增，且字段表已消除全部猜测空间。**该适配已记入开发日志。**

---

## 1. 文件结构地图（W1 定边界）

```text
backend/
├── pom.xml                                  # SB 3.3.4 / Java 17 / 依赖清单（见 Task 1）
├── mvnw  mvnw.cmd  .mvn/wrapper/            # 从模板复制，锁定 Maven 版本
├── src/main/java/com/jcpress/
│   ├── JcpressApplication.java              # 启动类（不 exclude Redis！模板 exclude 了，必须删）
│   ├── common/
│   │   ├── result/{Result,PageResult}.java  # 统一响应体 {code,message,data,traceId} / 分页体
│   │   ├── exception/{ErrorCodeEnum,BusinessException,ThrowUtils,GlobalExceptionHandler}.java
│   │   ├── constant/{ArticleConstant,RedisKeyConstant,UploadConstant}.java
│   │   ├── enums/{ArticleTypeEnum,ArticleStatusEnum}.java
│   │   └── util/{SlugUtils,WordCountUtils,IpUtils,HashUtils}.java
│   ├── infrastructure/
│   │   ├── config/{GsonConfig,WebMvcConfig,SaTokenConfigure,MyBatisPlusConfig,RedisConfig,OpenApiConfig,DevCorsConfig}.java
│   │   ├── gson/{LocalDateTimeAdapter,LocalDateAdapter,LongToStringAdapter}.java
│   │   ├── web/{TraceIdFilter,GlobalResponseAdvice? 无 —— 统一在 handler 里}.java
│   │   ├── cache/CacheKeyBuilder.java
│   │   └── storage/{FileStorage,LocalFileStorage,StoredFile}.java
│   ├── domain/{dataobject,dto,query,vo,converter}/   # Task 4 只放 health 用不到的空壳；W2 填
│   ├── repository/                          # @MapperScan 目标；W2 填
│   ├── manager/                             # W2 填
│   ├── service/ + service/impl/              # W1 放 HealthService（探活）
│   └── web/{portal,admin}/controller/        # W1 放 portal/HealthController
├── src/main/resources/
│   ├── application.yml  application-dev.yml  application-test.yml  application-prod.yml
│   ├── mapper/                              # W2 填
│   ├── db/migration/V1__init_schema.sql     # §6 DDL（已实测可建成）
│   └── db/migration/V2__seed_data.sql       # W2 填
└── src/test/java/com/jcpress/
    ├── ArchitectureTest.java                # ArchUnit：分层/依赖/注解类规则
    ├── SourceConventionTest.java            # 源码文本扫描：Lombok 白名单、RequestMethod、裸 @RequestMapping
    ├── support/{TestcontainersProfileNote,RedisTestSupport}.java
    ├── web/ResultContractTest.java          # 统一响应体 + HTTP 状态码（MockMvc）
    ├── infrastructure/GsonContractTest.java # Long 字符串化 / 时间格式 / null 字段
    ├── infrastructure/SaTokenRedisTest.java # ★ 运行时探针：登录→写 Redis→读回（验证 Redis 5.0 兼容）
    └── web/portal/HealthControllerTest.java
```

---

## 2. 验收门（每个工作流结束必须全绿）

| 门 | 命令（工作目录 `backend/`） | 期望 |
| --- | --- | --- |
| 编译 | `mvn -q -DskipTests compile` | exit 0 |
| 单测 + 架构卡口 | `mvn -q test` | 全绿，输出含 `Tests run: N, Failures: 0, Errors: 0` |
| 关键接口冒烟 | `mvn spring-boot:run -Dspring-boot.run.profiles=dev` 后 `curl http://127.0.0.1:8080/api/health` | `{"code":0,...}`，且 `data.db=UP`、`data.redis=UP` |
| GET/POST 文本扫描 | `mvn -q test -Dtest=SourceConventionTest` | 全绿（`RequestMethod.PUT/PATCH/DELETE` 命中 0、无裸 `@RequestMapping`） |
| W4 视觉评估集 | 见 `docs/phase3-effect-matrix.md` | 每条判据全绿 + 四视口 `overflow=no` |

> **本机环境注意（已实测）**：Maven 3.6.3 默认挂在 Java 8 上 → 每条 mvn 命令前设 `$env:JAVA_HOME='C:\Program Files\Java\jdk-17'`。当前文件策略是 `danger-full-access`，Maven 可直接写 `D:\maven\repository`（探针阶段的 `.tmp\m2` 绕法已不需要）。
> **数据库**：本机 MySQL 8.0.36（root/123456）、Redis 5.0.14（**无密码**）。Docker Desktop 未运行 → 测试用本机库 `jcpress_test` + Redis `db 15`，不用 Testcontainers。

---

## 3. W1 · 后端骨架与规约卡口

### Task 1: 建 backend 工程骨架并编译通过

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/jcpress/JcpressApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Copy: `backend/mvnw`、`backend/mvnw.cmd`、`backend/.mvn/`（来自 `C:\Users\O\Desktop\官方项目模板\springboot-init\`）

- [ ] **Step 1: 写 `pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.4</version>
        <relativePath/>
    </parent>
    <groupId>com.jcpress</groupId>
    <artifactId>jcpress-backend</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <name>jcpress-backend</name>
    <properties>
        <java.version>17</java.version>
        <sa-token.version>1.44.0</sa-token.version>
        <mybatis-plus.version>3.5.7</mybatis-plus.version>
        <knife4j.version>4.5.0</knife4j.version>
    </properties>
    <dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-aop</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-redis</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
        <dependency><groupId>com.baomidou</groupId><artifactId>mybatis-plus-spring-boot3-starter</artifactId><version>${mybatis-plus.version}</version></dependency>
        <dependency><groupId>com.mysql</groupId><artifactId>mysql-connector-j</artifactId><scope>runtime</scope></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-mysql</artifactId></dependency>
        <dependency><groupId>cn.dev33</groupId><artifactId>sa-token-spring-boot3-starter</artifactId><version>${sa-token.version}</version></dependency>
        <dependency><groupId>cn.dev33</groupId><artifactId>sa-token-redis-template</artifactId><version>${sa-token.version}</version></dependency>
        <dependency><groupId>org.apache.commons</groupId><artifactId>commons-pool2</artifactId></dependency>
        <dependency><groupId>com.google.code.gson</groupId><artifactId>gson</artifactId></dependency>
        <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-crypto</artifactId></dependency>
        <dependency><groupId>org.apache.commons</groupId><artifactId>commons-lang3</artifactId></dependency>
        <dependency><groupId>com.github.xiaoymin</groupId><artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId><version>${knife4j.version}</version></dependency>
        <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-devtools</artifactId><scope>runtime</scope><optional>true</optional></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>com.tngtech.archunit</groupId><artifactId>archunit-junit5</artifactId><version>1.3.0</version><scope>test</scope></dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes><exclude><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></exclude></excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

> **为什么删掉模板这些**：`spring-boot-starter-data-elasticsearch`（搜索走 ngram 全文索引）、`cos_api`（改自建 `FileStorage`）、`wx-java-mp-spring-boot-starter`、`easyexcel`、`hutool-all`、`spring-session-data-redis`（会话交 Sa-Token）、`knife4j-openapi2`（Swagger2 不支持 SB3）、`freemarker`（代码生成器一并删）、`mybatis-spring-boot-starter`（换 MP 的 SB3 starter）。

- [ ] **Step 2: 写启动类**（**注意：不要 exclude RedisAutoConfiguration** —— 模板为了本地跑得快排除了它，我们必须要 Redis）

```java
package com.jcpress;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.jcpress.repository")
@EnableScheduling
public class JcpressApplication {
    public static void main(String[] args) {
        SpringApplication.run(JcpressApplication.class, args);
    }
}
```

- [ ] **Step 3: 复制 Maven Wrapper**：把模板的 `mvnw`、`mvnw.cmd`、`.mvn/` 复制到 `backend/`。
- [ ] **Step 4: 验证编译**

Run: `$env:JAVA_HOME='C:\Program Files\Java\jdk-17'; mvn -q -DskipTests compile`
Expected: exit 0（首次会下载依赖）

- [ ] **Step 5: Commit**：`git add backend && git commit -m "build(backend): 从官方模板起 SB3.3.4/Java17 骨架，删掉 ES/COS/微信/Excel 等无关依赖"`

---

### Task 2: 统一响应体与异常映射（HTTP 状态码同时正确）

**Files:**
- Create: `backend/src/main/java/com/jcpress/common/exception/ErrorCodeEnum.java`
- Create: `backend/src/main/java/com/jcpress/common/exception/{BusinessException,ThrowUtils}.java`
- Create: `backend/src/main/java/com/jcpress/common/result/{Result,PageResult}.java`
- Create: `backend/src/main/java/com/jcpress/common/exception/GlobalExceptionHandler.java`
- Create: `backend/src/main/java/com/jcpress/infrastructure/web/TraceIdFilter.java`
- Test: `backend/src/test/java/com/jcpress/web/ResultContractTest.java`

- [ ] **Step 1: 写失败测试**（先测契约：错误码 ↔ HTTP 状态码必须**同时**正确，这是规划 §9.1 的硬要求，也是模板没做到的 —— 模板一律 HTTP 200）

```java
package com.jcpress.web;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ResultContractTest.ProbeController.class)
@Import(com.jcpress.common.exception.GlobalExceptionHandler.class)
class ResultContractTest {

    @RestController
    static class ProbeController {
        @GetMapping("/probe/not-found")
        String notFound() { throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND); }

        @GetMapping("/probe/boom")
        String boom() { throw new IllegalStateException("内部细节不应外泄"); }
    }

    @Autowired MockMvc mockMvc;

    @Test
    void businessExceptionCarriesMatchingHttpStatusAndCode() throws Exception {
        mockMvc.perform(get("/probe/not-found"))
               .andExpect(status().isNotFound())                                // HTTP 404
               .andExpect(jsonPath("$.code").value(40401))                       // 业务码
               .andExpect(jsonPath("$.message").value("文章不存在"))
               // 用 nullValue 而不是 doesNotExist：Gson 开了 serializeNulls，null 字段会以 "data":null 出现
               .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()))
               .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void unexpectedExceptionIsMaskedAsSystemError() throws Exception {
        mockMvc.perform(get("/probe/boom"))
               .andExpect(status().isInternalServerError())
               .andExpect(jsonPath("$.code").value(50000))
               .andExpect(jsonPath("$.message").value("系统异常"))
               .andExpect(content().string(org.hamcrest.Matchers.not(
                       org.hamcrest.Matchers.containsString("内部细节不应外泄"))));
    }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `mvn -q test -Dtest=ResultContractTest`
Expected: 编译失败（`ErrorCodeEnum` / `GlobalExceptionHandler` 还不存在）

- [ ] **Step 3: 写 `ErrorCodeEnum`**（错误码分段照规划 §9.1，**每个枚举自带 HTTP 状态**）

```java
package com.jcpress.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCodeEnum {

    SUCCESS(0, "ok", HttpStatus.OK),
    PARAM_ERROR(40001, "参数校验失败", HttpStatus.BAD_REQUEST),
    NOT_LOGIN(40101, "未登录", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID(40102, "token 过期或无效", HttpStatus.UNAUTHORIZED),
    LOGIN_FAIL_LOCKED(40103, "登录失败次数过多，请稍后再试", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(40301, "禁止访问", HttpStatus.FORBIDDEN),
    ARTICLE_NOT_FOUND(40401, "文章不存在", HttpStatus.NOT_FOUND),
    SLUG_CONFLICT(40901, "slug 已存在", HttpStatus.CONFLICT),
    RATE_LIMITED(42901, "请求过于频繁", HttpStatus.TOO_MANY_REQUESTS),
    SYSTEM_ERROR(50000, "系统异常", HttpStatus.INTERNAL_SERVER_ERROR),
    OPERATION_ERROR(50001, "操作失败", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCodeEnum(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
```

- [ ] **Step 4: 写 `BusinessException` / `ThrowUtils`**（照模板改包名，`BusinessException` 增加 `ErrorCodeEnum` 构造）

```java
package com.jcpress.common.exception;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

    private final int code;

    public BusinessException(ErrorCodeEnum errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCodeEnum errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }
}
```

```java
package com.jcpress.common.exception;

public final class ThrowUtils {

    private ThrowUtils() {
    }

    public static void throwIf(boolean condition, ErrorCodeEnum errorCode) {
        if (condition) {
            throw new BusinessException(errorCode);
        }
    }

    public static void throwIf(boolean condition, ErrorCodeEnum errorCode, String message) {
        if (condition) {
            throw new BusinessException(errorCode, message);
        }
    }
}
```

- [ ] **Step 5: 写 `Result` / `PageResult`**（`Result` 从 MDC 取 traceId 填充）

```java
package com.jcpress.common.result;

import com.jcpress.common.exception.ErrorCodeEnum;
import lombok.Data;
import org.slf4j.MDC;

import java.io.Serializable;

@Data
public class Result<T> implements Serializable {

    private int code;
    private String message;
    private T data;
    private String traceId;

    private Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = MDC.get("traceId");
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(ErrorCodeEnum.SUCCESS.getCode(), ErrorCodeEnum.SUCCESS.getMessage(), data);
    }

    public static Result<Void> success() {
        return success(null);
    }

    public static <T> Result<T> error(ErrorCodeEnum errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    public static <T> Result<T> error(ErrorCodeEnum errorCode, String message) {
        return new Result<>(errorCode.getCode(), message, null);
    }
}
```

```java
package com.jcpress.common.result;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
public class PageResult<T> implements Serializable {

    private List<T> list;
    private long page;
    private long size;
    private long total;
    private long pages;

    public static <T> PageResult<T> of(List<T> list, long page, long size, long total) {
        PageResult<T> result = new PageResult<>();
        result.list = list;
        result.page = page;
        result.size = size;
        result.total = total;
        result.pages = size <= 0 ? 0 : (total + size - 1) / size;
        return result;
    }
}
```

- [ ] **Step 6: 写 `TraceIdFilter`**（每请求 8 位 traceId → MDC + 响应头 `X-Trace-Id`）

```java
package com.jcpress.infrastructure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String TRACE_ID = "traceId";
    public static final String HEADER = "X-Trace-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put(TRACE_ID, traceId);
        response.setHeader(HEADER, traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(TRACE_ID);
        }
    }
}
```

- [ ] **Step 7: 写 `GlobalExceptionHandler`**（分层异常的最后一环：不向前端吐堆栈；Service 层才记日志）

```java
package com.jcpress.common.exception;

import com.jcpress.common.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException e) {
        ErrorCodeEnum errorCode = resolveCode(e.getCode());
        return ResponseEntity.status(errorCode.getHttpStatus()).body(Result.error(errorCode, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(ErrorCodeEnum.PARAM_ERROR.getHttpStatus())
                .body(Result.error(ErrorCodeEnum.PARAM_ERROR, detail));
    }

    /** 兜底：日志留现场，前端只拿到脱敏文案（Agent.md：禁止直接向前端抛原始堆栈） */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleUnexpected(Exception e, HttpServletRequest request) {
        log.error("未预期异常 uri={} method={}", request.getRequestURI(), request.getMethod(), e);
        return ResponseEntity.status(ErrorCodeEnum.SYSTEM_ERROR.getHttpStatus())
                .body(Result.error(ErrorCodeEnum.SYSTEM_ERROR));
    }

    private ErrorCodeEnum resolveCode(int code) {
        for (ErrorCodeEnum candidate : ErrorCodeEnum.values()) {
            if (candidate.getCode() == code) {
                return candidate;
            }
        }
        return ErrorCodeEnum.OPERATION_ERROR;
    }
}
```

- [ ] **Step 8: 跑测试确认通过**

Run: `mvn -q test -Dtest=ResultContractTest`
Expected: PASS（2 个用例）

- [ ] **Step 9: Commit**：`git commit -m "feat(backend): 统一响应体与全局异常映射（HTTP 状态码与业务码同时正确，traceId 贯通）"`

---

### Task 3: Gson 取代 Jackson（Long 字符串化 / 时间格式 / null 字段）

**Files:**
- Create: `backend/src/main/java/com/jcpress/infrastructure/gson/{LocalDateTimeAdapter,LocalDateAdapter,LongToStringAdapter}.java`
- Create: `backend/src/main/java/com/jcpress/infrastructure/config/GsonConfig.java`
- Test: `backend/src/test/java/com/jcpress/infrastructure/GsonContractTest.java`

- [ ] **Step 1: 写失败测试**（规划 §5.4 列的三个坑逐条断言）

```java
package com.jcpress.infrastructure;

import com.google.gson.Gson;
import com.jcpress.infrastructure.config.GsonConfig;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class GsonContractTest {

    static class Payload {
        Long id = 1900000000000000001L;
        LocalDateTime publishedAt = LocalDateTime.of(2026, 8, 12, 9, 30, 0);
        LocalDate day = LocalDate.of(2026, 8, 12);
        String missing = null;
    }

    private final Gson gson = GsonConfig.buildGson();

    @Test
    void longIsSerializedAsStringToAvoidJsPrecisionLoss() {
        assertThat(gson.toJson(new Payload())).contains("\"id\":\"1900000000000000001\"");
    }

    @Test
    void javaTimeUsesProjectFormat() {
        String json = gson.toJson(new Payload());
        assertThat(json).contains("\"publishedAt\":\"2026-08-12 09:30:00\"");
        assertThat(json).contains("\"day\":\"2026-08-12\"");
    }

    @Test
    void nullFieldsAreEmittedSoFrontendTypesStayStable() {
        assertThat(gson.toJson(new Payload())).contains("\"missing\":null");
    }
}
```

- [ ] **Step 2: 跑测试确认失败**：`mvn -q test -Dtest=GsonContractTest` → 编译失败（`GsonConfig` 不存在）
- [ ] **Step 3: 写三个适配器**

```java
package com.jcpress.infrastructure.gson;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class LocalDateTimeAdapter extends TypeAdapter<LocalDateTime> {

    public static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public void write(JsonWriter out, LocalDateTime value) throws IOException {
        if (value == null) {
            out.nullValue();
            return;
        }
        out.value(FORMATTER.format(value));
    }

    @Override
    public LocalDateTime read(JsonReader in) throws IOException {
        if (in.peek() == JsonToken.NULL) {
            in.nextNull();
            return null;
        }
        return LocalDateTime.parse(in.nextString(), FORMATTER);
    }
}
```

```java
package com.jcpress.infrastructure.gson;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public class LocalDateAdapter extends TypeAdapter<LocalDate> {

    public static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public void write(JsonWriter out, LocalDate value) throws IOException {
        if (value == null) {
            out.nullValue();
            return;
        }
        out.value(FORMATTER.format(value));
    }

    @Override
    public LocalDate read(JsonReader in) throws IOException {
        if (in.peek() == JsonToken.NULL) {
            in.nextNull();
            return null;
        }
        return LocalDate.parse(in.nextString(), FORMATTER);
    }
}
```

```java
package com.jcpress.infrastructure.gson;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;

/** Long 一律以字符串下发：JS 的安全整数上限是 2^53-1，雪花/自增 ID 会失真 */
public class LongToStringAdapter extends TypeAdapter<Long> {

    @Override
    public void write(JsonWriter out, Long value) throws IOException {
        if (value == null) {
            out.nullValue();
            return;
        }
        out.value(String.valueOf(value));
    }

    @Override
    public Long read(JsonReader in) throws IOException {
        if (in.peek() == JsonToken.NULL) {
            in.nextNull();
            return null;
        }
        return Long.valueOf(in.nextString());
    }
}
```

- [ ] **Step 4: 写 `GsonConfig`**（`buildGson()` 静态工厂供测试复用；转换器放 `converters[0]` 覆盖 Jackson）

```java
package com.jcpress.infrastructure.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.jcpress.infrastructure.gson.LocalDateAdapter;
import com.jcpress.infrastructure.gson.LocalDateTimeAdapter;
import com.jcpress.infrastructure.gson.LongToStringAdapter;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.GsonHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Configuration
public class GsonConfig implements WebMvcConfigurer {

    public static Gson buildGson() {
        return new GsonBuilder()
                .serializeNulls()
                .disableHtmlEscaping()
                .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
                .registerTypeAdapter(LocalDate.class, new LocalDateAdapter())
                .registerTypeAdapter(Long.class, new LongToStringAdapter())
                .registerTypeAdapter(Long.TYPE, new LongToStringAdapter())
                .create();
    }

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        GsonHttpMessageConverter converter = new GsonHttpMessageConverter(buildGson());
        converter.setSupportedMediaTypes(List.of(MediaType.APPLICATION_JSON));
        converters.add(0, converter);
    }
}
```

- [ ] **Step 5: 跑测试确认通过**：`mvn -q test -Dtest=GsonContractTest` → PASS（3 个用例）
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): Gson 取代 Jackson —— Long 字符串化、时间格式、null 字段三个坑各配适配器"`

---

### Task 4: 数据源 + MyBatis-Plus + Flyway（落 §6 DDL）

**Files:**
- Create: `backend/src/main/resources/application.yml`（改写 Task 1 占位）+ `application-dev.yml` / `application-test.yml` / `application-prod.yml`
- Create: `backend/src/main/java/com/jcpress/infrastructure/config/MyBatisPlusConfig.java`
- Create: `backend/src/main/resources/db/migration/V1__init_schema.sql`
- Test: `backend/src/test/java/com/jcpress/infrastructure/FlywayMigrationTest.java`

- [ ] **Step 1: 建测试库**：`mysql -uroot -p123456 -e "CREATE DATABASE IF NOT EXISTS jcpress_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"`
- [ ] **Step 2: 写 `V1__init_schema.sql`**：内容 = 规划文档 §6.1/§6.2/§6.3 的 DDL（**唯一源是 [`docs/项目前期规划.md`](项目前期规划.md) §6**），7 张表：`admin_user` / `admin_audit_log` / `category` / `tag` / `article` / `article_tag` / `article_content`。这份 DDL 已在 MySQL 8.0.36 上**实测建成**（含 `FULLTEXT ... WITH PARSER ngram`），验证脚本留在 `.tmp/probe-sql/ddl-probe.sql`（未入库，可随时重跑）。
- [ ] **Step 3: 写 `MyBatisPlusConfig`**（**注意两点**：① `@MapperScan` 指向 `com.jcpress.repository`；② 模板 yml 里的 `logic-delete-field: isDelete` **必须删掉** —— 我们的表没有 `is_delete` 列，全局逻辑删除会让每条查询都拼上 `is_delete=0` 而直接报错）

```java
package com.jcpress.infrastructure.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MyBatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

- [ ] **Step 4: 写 `application.yml`（公共）+ 三个 profile**

```yaml
spring:
  application:
    name: jcpress-backend
  profiles:
    active: dev
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 6MB
  jackson:
    time-zone: Asia/Shanghai

server:
  port: 8080
  servlet:
    context-path: /api

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true      # DO 用 camelCase 字段映射 snake_case 列
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
  global-config:
    banner: false
    db-config:
      id-type: auto
      # 注意：不配置 logic-delete-field —— 本项目物理删除（规划 §6.6）

sa-token:
  token-name: jcpress-token
  timeout: 604800
  active-timeout: 1800
  is-concurrent: true
  token-style: uuid
  is-log: false

jcpress:
  upload:
    dir: ./uploads
    url-prefix: /uploads
    allowed-extensions: jpg,jpeg,png,webp,gif
    max-bytes: 5242880

knife4j:
  enable: true
  openapi:
    title: jcpress 接口文档
    version: 1.0
    group:
      default:
        api-rule: package
        api-rule-resources:
          - com.jcpress.web
```

```yaml
# application-dev.yml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/jcpress?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
    username: root
    password: 123456
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      database: 0
      timeout: 5000

logging:
  level:
    com.jcpress: debug
```

```yaml
# application-test.yml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/jcpress_test?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
    username: root
    password: 123456
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      database: 15          # 与业务库隔离，便于清理
      timeout: 5000
  flyway:
    clean-disabled: false
```

- [ ] **Step 5: 写迁移测试**（断言 7 张表都在、ngram 全文索引可用）

```java
package com.jcpress.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FlywayMigrationTest {

    @Autowired JdbcTemplate jdbcTemplate;

    @Test
    void allArticleModuleTablesExist() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()", String.class);
        assertThat(tables).contains("article", "article_content", "category", "tag", "article_tag",
                "admin_user", "admin_audit_log");
    }

    @Test
    void ngramFulltextIndexIsQueryable() {
        Integer hit = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article WHERE MATCH(title, summary) AGAINST('分片' IN BOOLEAN MODE)",
                Integer.class);
        assertThat(hit).isNotNull();
    }
}
```

- [ ] **Step 6: 跑测试**：`mvn -q test -Dtest=FlywayMigrationTest` → PASS
- [ ] **Step 7: Commit**：`git commit -m "feat(backend): 数据源 + MyBatis-Plus + Flyway 落 §6 DDL（含 ngram 全文索引）"`

---

### Task 5: Redis + Sa-Token（**运行时探针**：验证 1.44.0 在本机 Redis 5.0 上真的能用）

**Files:**
- Create: `backend/src/main/java/com/jcpress/infrastructure/config/{RedisConfig,SaTokenConfigure}.java`
- Test: `backend/src/test/java/com/jcpress/infrastructure/SaTokenRedisTest.java`

- [ ] **Step 1: 写 `SaTokenConfigure` 与 `RedisConfig`**

```java
package com.jcpress.infrastructure.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.router.SaRouter;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SaInterceptor(handle -> SaRouter
                        .match("/v1/admin/**")
                        .notMatch("/v1/admin/auth/login")
                        .check(r -> StpUtil.checkLogin())))
                .addPathPatterns("/**");
    }
}
```

```java
package com.jcpress.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class RedisConfig {

    /** 业务侧只操作字符串键值（浏览量去重/计数、登录失败计数、限流） */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
```

> 注：`context-path=/api`，所以拦截器里的匹配路径写 `/v1/admin/**`（不含 `/api` 前缀）。

- [ ] **Step 2: 写运行时探针测试**（这一条是本期**风险最高**的技术假设：Sa-Token 1.44.0 + SB 3.3.4 + **Redis 5.0.14**。jar 静态检查只能证明没有 `KEEPTTL`，证明不了整条链路）

```java
package com.jcpress.infrastructure;

import cn.dev33.satoken.stp.StpUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SaTokenRedisTest {

    @Autowired StringRedisTemplate redis;

    @Test
    void loginRoundTripsThroughLocalRedis5() {
        StpUtil.login(1001L);
        String token = StpUtil.getTokenValue();

        // ① token 索引与会话真的写进了 Redis（键前缀取自 token-name）
        Set<String> keys = redis.keys("jcpress-token*");
        assertThat(keys).isNotEmpty();

        // ② 能按 token 反查登录主体（这条会走到 SaTokenDao 的读路径）
        //    注意用 String.valueOf 包一层：loginId 走 Redis 序列化回来可能是 Long/Integer，直接比字符串会假红
        assertThat(String.valueOf(StpUtil.getLoginIdByToken(token))).isEqualTo("1001");

        // ③ 续期路径（历史上 1.46.0 在这里用 SET ... KEEPTTL，Redis 5 会报 ERR syntax error）
        StpUtil.renewTimeout(60);
        assertThat(String.valueOf(StpUtil.getLoginIdByToken(token))).isEqualTo("1001");

        StpUtil.logout();
        assertThat(StpUtil.getLoginIdByToken(token)).isNull();
    }
}
```

- [ ] **Step 3: 跑探针**：`mvn -q test -Dtest=SaTokenRedisTest`
Expected: PASS。**若报 `ERR syntax error` 或 `unknown command`** → 立刻停下：说明 1.44.0 也有 Redis 6 依赖，届时按设计文档 D1 的备选（自研 `SaTokenDao` 基于 `SETEX`/`EXPIRE`）改，并把结论回写 `decisions.md`。
- [ ] **Step 4: Commit**：`git commit -m "feat(backend): Sa-Token 1.44.0 + Redis 接入，并用运行时探针验证本机 Redis 5.0 兼容"`

---

### Task 6: 分页查询对象与 Service/DAO 骨架

**Files:**
- Create: `backend/src/main/java/com/jcpress/domain/query/PageQuery.java`
- Create: `backend/src/main/java/com/jcpress/service/HealthService.java` + `service/impl/HealthServiceImpl.java`
- Test: `backend/src/test/java/com/jcpress/service/PageQueryTest.java`

- [ ] **Step 1: 写失败测试**（`size` 必须服务端限幅，防内存溢出 —— §11.5 安全规约第 4 条；`page` 至少从 1 开始）

```java
package com.jcpress.service;

import com.jcpress.domain.query.PageQuery;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PageQueryTest {

    @Test
    void sizeIsClampedToServerMaximum() {
        PageQuery query = new PageQuery();
        query.setSize(5000);
        assertThat(query.normalizedSize()).isEqualTo(50);
    }

    @Test
    void pageAndSizeFallBackToDefaultsWhenIllegal() {
        PageQuery query = new PageQuery();
        query.setPage(0);
        query.setSize(-3);
        assertThat(query.normalizedPage()).isEqualTo(1);
        assertThat(query.normalizedSize()).isEqualTo(10);
    }
}
```

- [ ] **Step 2: 跑测试确认失败**：`mvn -q test -Dtest=PageQueryTest`
- [ ] **Step 3: 写 `PageQuery`**

```java
package com.jcpress.domain.query;

import lombok.Data;

@Data
public class PageQuery {

    public static final int MAX_SIZE = 50;
    public static final int DEFAULT_SIZE = 10;
    private static final int DEFAULT_PAGE = 1;

    private Integer page = DEFAULT_PAGE;
    private Integer size = DEFAULT_SIZE;

    public int normalizedPage() {
        return page == null || page < 1 ? DEFAULT_PAGE : page;
    }

    public int normalizedSize() {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    /** MyBatis-Plus 分页插件的 offset（offset 从 0 开始） */
    public long offset() {
        return (long) (normalizedPage() - 1) * normalizedSize();
    }
}
```

- [ ] **Step 4: 写 `HealthService` + impl（先接口后实现，Controller 只依赖接口 —— Agent.md + ArchUnit 规则 4）**

```java
package com.jcpress.service;

import java.util.Map;

public interface HealthService {

    Map<String, Object> check();
}
```

```java
package com.jcpress.service.impl;

import com.jcpress.service.HealthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class HealthServiceImpl implements HealthService {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @Override
    public Map<String, Object> check() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("db", probeDb());
        status.put("redis", probeRedis());
        return status;
    }

    private String probeDb() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return "UP";
        } catch (Exception e) {
            log.error("数据库探活失败", e);
            return "DOWN";
        }
    }

    private String probeRedis() {
        try {
            redisTemplate.opsForValue().set("health:probe", "1");
            return "UP";
        } catch (Exception e) {
            log.error("Redis 探活失败", e);
            return "DOWN";
        }
    }
}
```

- [ ] **Step 5: 跑测试**：`mvn -q test -Dtest=PageQueryTest` → PASS
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): 分页查询对象（size 服务端限幅）与 HealthService 分层骨架"`

---

### Task 7: ArchUnit 卡口 + 源码文本扫描（把 Agent.md 的规则变成判据）

**Files:**
- Create: `backend/src/test/java/com/jcpress/ArchitectureTest.java`
- Create: `backend/src/test/java/com/jcpress/SourceConventionTest.java`

- [ ] **Step 1: 写 `ArchitectureTest`**（设计 D2 的规则 1–7、9–11）

```java
package com.jcpress;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.Set;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

@AnalyzeClasses(packages = "com.jcpress")
class ArchitectureTest {

    private static final Set<String> VERB_PREFIXES =
            Set.of("get", "list", "count", "save", "insert", "remove", "delete", "update");
    private static final Set<String> OBJECT_METHODS =
            Set.of("equals", "hashCode", "toString", "clone", "finalize", "canEqual");

    @ArchTest
    static final ArchRule portalMustNotDependOnAdmin =
            noClasses().that().resideInAPackage("..web.portal..")
                    .should().dependOnClassesThat().resideInAPackage("..web.admin..");

    @ArchTest
    static final ArchRule adminMustNotDependOnPortal =
            noClasses().that().resideInAPackage("..web.admin..")
                    .should().dependOnClassesThat().resideInAPackage("..web.portal..");

    @ArchTest
    static final ArchRule webMustNotTouchRepository =
            noClasses().that().resideInAPackage("..web..")
                    .should().dependOnClassesThat().resideInAPackage("..repository..");

    @ArchTest
    static final ArchRule dataObjectsMustNotLeakToWeb =
            noClasses().that().resideInAPackage("..web..")
                    .should().dependOnClassesThat().resideInAPackage("..domain.dataobject..");

    @ArchTest
    static final ArchRule controllersMustDependOnServiceInterfacesOnly =
            noClasses().that().resideInAPackage("..web..")
                    .should().dependOnClassesThat().resideInAPackage("..service.impl..");

    @ArchTest
    static final ArchRule commonAndInfrastructureMustNotDependOnBusiness =
            noClasses().that().resideInAnyPackage("..common..", "..infrastructure..")
                    .should().dependOnClassesThat()
                    .resideInAnyPackage("..domain..", "..service..", "..repository..", "..manager..", "..web..");

    @ArchTest
    static final ArchRule managerIsOnlyUsedByService =
            noClasses().that().resideInAnyPackage("..repository..", "..web..")
                    .should().dependOnClassesThat().resideInAPackage("..manager..");

    @ArchTest
    static final ArchRule noFieldAutowiredInjection =
            noFields().should().beAnnotatedWith(Autowired.class);

    @ArchTest
    static final ArchRule noFieldResourceInjection =
            noFields().should().beAnnotatedWith("jakarta.annotation.Resource");

    @ArchTest
    static final ArchRule serviceAndRepositoryMethodsUseVerbPrefix =
            methods().that().arePublic().and().areDeclaredInClassesThat()
                    .resideInAnyPackage("..service..", "..repository..")
                    .should(new ArchCondition<>("方法名以 get/list/count/save/insert/remove/delete/update 开头") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            if (method.getModifiers().contains(JavaModifier.STATIC)) {
                                return;
                            }
                            String name = method.getName();
                            if (OBJECT_METHODS.contains(name)) {
                                return;
                            }
                            boolean ok = VERB_PREFIXES.stream().anyMatch(name::startsWith);
                            if (!ok) {
                                events.add(SimpleConditionEvent.violated(method,
                                        method.getFullName() + " 未以动词前缀开头（Agent.md 命名规约）"));
                            }
                        }
                    });

    @ArchTest
    static final ArchRule serviceMustNotUseQueryWrapper =
            noClasses().that().resideInAnyPackage("..service..", "..service.impl..")
                    .should().dependOnClassesThat().areAssignableTo(QueryWrapper.class);

    @ArchTest
    static final ArchRule onlyGetAndPostMappings =
            noMethods().should().beAnnotatedWith(PutMapping.class)
                    .orShould().beAnnotatedWith(PatchMapping.class)
                    .orShould().beAnnotatedWith(DeleteMapping.class);

    /**
     * 裸 @RequestMapping 的兜住口 —— 只查**方法级**：
     * 类级的 @RequestMapping("/v1/articles") 只提供路径前缀，是标准写法，必须放过；
     * 方法级的 @RequestMapping 不带 method 等于对 PUT/DELETE 全开放，必须禁。
     * （这一条**不能用文本正则**做：正则分不清类级与方法级，会把标准写法一起误伤。）
     */
    @ArchTest
    static final ArchRule methodLevelRequestMappingMustDeclareMethod =
            methods().that().areAnnotatedWith(org.springframework.web.bind.annotation.RequestMapping.class)
                    .should(new ArchCondition<>("声明 method 属性（否则等于对所有 HTTP 方法开放）") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            org.springframework.web.bind.annotation.RequestMapping mapping =
                                    method.getAnnotationOfType(org.springframework.web.bind.annotation.RequestMapping.class);
                            if (mapping.method().length == 0) {
                                events.add(SimpleConditionEvent.violated(method,
                                        method.getFullName() + " 的 @RequestMapping 未声明 method"));
                            }
                        }
                    });
}
```

> 命名规则会**反向约束实现**：发布/撤回不能叫 `publishArticle()`，必须叫 `updateStatus(...)`；删除用 `removeArticle(...)`。这是规则生效的证据，不是笔误。

- [ ] **Step 2: 写 `SourceConventionTest`**（ArchUnit 看不到的两类：**Lombok 注解是 SOURCE 保留级，不进字节码**；`RequestMethod.PUT` 与裸 `@RequestMapping` 是注解**属性值**）

```java
package com.jcpress;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class SourceConventionTest {

    private static final Path SOURCE_ROOT = Path.of("src/main/java");

    private static List<Path> javaFiles() throws IOException {
        try (Stream<Path> stream = Files.walk(SOURCE_ROOT)) {
            return stream.filter(path -> path.toString().endsWith(".java")).toList();
        }
    }

    @Test
    void lombokUsageIsLimitedToWhitelist() throws IOException {
        Set<String> whitelist = Set.of("Data", "Getter", "Setter", "Slf4j");
        Pattern annotation = Pattern.compile("@(Builder|AllArgsConstructor|NoArgsConstructor|EqualsAndHashCode|Value|ToString|RequiredArgsConstructor)\\b");
        Map<Path, String> violations = new LinkedHashMap<>();
        for (Path file : javaFiles()) {
            Matcher matcher = annotation.matcher(Files.readString(file, StandardCharsets.UTF_8));
            while (matcher.find()) {
                violations.put(file, matcher.group(1));
            }
        }
        // RequiredArgsConstructor 是 Agent.md 明确要求的构造器注入手段，单独豁免
        violations.entrySet().removeIf(entry -> "RequiredArgsConstructor".equals(entry.getValue()));
        assertThat(violations).as("只允许 @Data/@Getter/@Setter/@Slf4j（+ 构造器注入用的 @RequiredArgsConstructor）").isEmpty();
    }

    @Test
    void noPutPatchDeleteByRequestMethodAttribute() throws IOException {
        for (Path file : javaFiles()) {
            String source = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(source).as("%s 不得出现 RequestMethod.PUT/PATCH/DELETE", file)
                    .doesNotContain("RequestMethod.PUT")
                    .doesNotContain("RequestMethod.PATCH")
                    .doesNotContain("RequestMethod.DELETE");
        }
    }

    // 「裸 @RequestMapping」不在这里查 —— 正则分不清类级与方法级，会把 @RequestMapping("/v1/articles")
    // 这种标准写法误伤。它由 ArchitectureTest.methodLevelRequestMappingMustDeclareMethod（只查方法级）负责。

    @Test
    void noQueryWrapperImport() throws IOException {
        for (Path file : javaFiles()) {
            String path = file.toString().replace('\\', '/');
            if (!path.contains("/service/")) {
                continue;
            }
            String source = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(source).as("%s 位于 service 层，不得引用 QueryWrapper", file)
                    .doesNotContain("QueryWrapper");
        }
    }
}
```

- [ ] **Step 3: 跑卡口**：`mvn -q test -Dtest='ArchitectureTest,SourceConventionTest'`
Expected: 全绿（此时业务代码还很少，规则应天然满足；若红了说明骨架已经违反了规则，**先修骨架再继续**）
- [ ] **Step 4: Commit**：`git commit -m "test(backend): ArchUnit + 源码扫描把 Agent.md 的 6 条规则落成可执行判据"`

---

### Task 8: 健康检查接口 + 冒烟

**Files:**
- Create: `backend/src/main/java/com/jcpress/web/portal/controller/HealthController.java`
- Test: `backend/src/test/java/com/jcpress/web/portal/HealthControllerTest.java`

- [ ] **Step 1: 写 Controller**（公开、零鉴权；注意路径不含 `/api` 前缀 —— 那是 `context-path`）

```java
package com.jcpress.web.portal.controller;

import com.jcpress.common.result.Result;
import com.jcpress.service.HealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
@Tag(name = "健康检查")
public class HealthController {

    private final HealthService healthService;

    @GetMapping
    @Operation(summary = "探活（含 DB / Redis）")
    public Result<Map<String, Object>> health() {
        return Result.success(healthService.check());
    }
}
```

- [ ] **Step 2: 写测试**

```java
package com.jcpress.web.portal;

import com.jcpress.web.portal.controller.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import com.jcpress.service.HealthService;

import java.util.Map;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = HealthController.class)
class HealthControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean HealthService healthService;

    @Test
    void healthIsPublicAndReturnsUnifiedBody() throws Exception {
        given(healthService.check()).willReturn(Map.of("db", "UP", "redis", "UP"));

        mockMvc.perform(get("/health"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.code").value(0))
               .andExpect(jsonPath("$.message").value("ok"))
               .andExpect(jsonPath("$.data.db").value("UP"))
               .andExpect(jsonPath("$.data.redis").value("UP"));
    }
}
```

- [ ] **Step 3: 跑测试**：`mvn -q test`（全量，含架构卡口）
- [ ] **Step 4: 真跑一次冒烟**

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
mysql -uroot -p123456 -e "CREATE DATABASE IF NOT EXISTS jcpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mvn spring-boot:run "-Dspring-boot.run.profiles=dev"      # 后台任务
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

Expected: `code=0`、`data.db=UP`、`data.redis=UP`，Flyway 日志有 `Migrating schema ... to version "1"`

- [ ] **Step 5: Commit**：`git commit -m "feat(backend): /api/health 探活接口（DB + Redis）与 MockMvc 契约测试"`

---

### Task 9: W1 出口复核与留痕

- [ ] **Step 1: 过验收门**：`mvn -q -DskipTests compile` → `mvn -q test` → 冒烟一次（三条全绿）
- [ ] **Step 2: 在 `docs/dev-journal.md` 追加「阶段 32 · W1」**，四样都写：关键原话（本轮无新指令，如实写「无新增指令」）· 关键产出（文件清单 + 测试数 + 探针结论）· 纠偏 · 翻车与返工（尤其 **Sa-Token 运行时探针的真实结果**）
- [ ] **Step 3: 把新踩到的环境/技术结论回写 `docs/decisions.md`**（若有）
- [ ] **Step 4: Commit**：`git commit -m "docs(phase-3): W1 后端骨架完成留痕"`

---

## 4. W1 的风险点（执行时盯住这三条）

| # | 风险 | 应对 |
| --- | --- | --- |
| 1 | **Sa-Token 1.44.0 在 Redis 5.0 上的运行时行为**（唯一没验证过的高风险假设） | Task 5 Step 3 的探针就是为它写的；失败则按设计 D1 备选自研 `SaTokenDao`，并回写 decisions |
| 2 | **MyBatis-Plus 全局逻辑删除配置残留**会让所有查询拼 `is_delete=0` 直接报错 | Task 4 Step 4 明确要求不配置 `logic-delete-field`；Task 4 的迁移测试会先暴露 |
| 3 | 命名卡口（动词前缀）会**反向约束**后续方法名 | W2/W3 写 Service 时：发布= `updateStatus`、删除= `removeArticle`、查列表= `listPublished*` |
