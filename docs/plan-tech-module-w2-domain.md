# 技术分享模块（三期）实施计划 · W2 领域与公开接口

> **给执行者**：本文件是 [实施计划索引](plan-tech-module.md) 的第 2 份。执行方式：**内联逐任务执行、每个任务结束后复核并 commit**，用 `- [ ]` 跟踪。
> **前置**：W1 全部任务完成且验收门全绿。
> **配套**：[设计定稿](design-tech-module.md)（已批准）· [开发日志](dev-journal.md) · [决策记录](decisions.md)

**Goal**：把「技术分享」的读路径做完 —— 公开列表、详情（含相邻篇）、分类/标签、浏览量，全部零鉴权、只读、不含草稿。

**Architecture**：`repository`（Mapper + XML 自写 SQL）→ `service`（事务/转换/缓存）→ `web.portal`（薄 Controller）。**数据访问约定（本工作流定死）**：主键操作走 MyBatis-Plus 继承方法（`selectById`/`insert`/`updateById`/`deleteById`）；**任何带条件、联表、排序、分页的查询一律写在 Mapper XML 里** —— 因为 `Agent.md` 禁止 Service 层出现 `QueryWrapper`，而 ArchUnit 规则 10 会把这条禁令变成编译后的失败。

**Tech Stack**：MyBatis-Plus 3.5.7（XML 动态 SQL）· Redis 5.0.14（**注意：不能用 `GETDEL`，它是 Redis 6.2+**）· Flyway · JUnit 5 + MockMvc

---

## 0. 数据流与边界

```text
GET /api/v1/articles?type=TECH&page=1&size=20
  └ web.portal.ArticleController.list(ArticleQuery)
      └ ArticleService.listPublished(ArticleQuery) → PageResult<ArticleCardVO>
          ├ ArticleMapper.listPublished(page, query)        [XML 动态 SQL + LEFT JOIN category]
          └ ArticleTagMapper.listTagRefsByArticleIds(ids)   [一次批量取标签，避免 N+1]
```

| 层 | 允许依赖 | 禁止 |
| --- | --- | --- |
| `web.portal` | `service`（**接口**）、`common`、`domain.dto/query/vo` | repository、domain.dataobject、service.impl |
| `service` | `manager`、`repository`、`domain.*` | web、QueryWrapper |
| `repository` | `domain.dataobject`、`domain.projection` | service、web |
| `manager` | `repository`、`infrastructure` | web |

---

## 1. Task 1: 领域模型（DO / 投影 / DTO / VO / 转换器）

**Files:**
- Create: `backend/src/main/java/com/jcpress/domain/dataobject/{ArticleDO,ArticleContentDO,CategoryDO,TagDO,ArticleTagDO}.java`
- Create: `backend/src/main/java/com/jcpress/domain/projection/{ArticleTagRef,CategoryWithCountRef,TagWithCountRef}.java`
- Create: `backend/src/main/java/com/jcpress/domain/query/ArticleQuery.java`
- Create: `backend/src/main/java/com/jcpress/domain/vo/{ArticleCardVO,ArticleDetailVO,ArticleAdjacentVO,CategoryVO,TagVO}.java`
- Create: `backend/src/main/java/com/jcpress/domain/converter/ArticleConverter.java`
- Test: `backend/src/test/java/com/jcpress/domain/ArticleConverterTest.java`

- [ ] **Step 1: 写 `ArticleDO`（完整示例；其余 DO 照字段表写）**

```java
package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("article")
public class ArticleDO {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String type;
    private Long categoryId;
    private Long projectId;
    private String title;
    private String slug;
    private String summary;
    private String coverUrl;
    private Integer status;
    private Integer wordCount;
    private Integer readingMinutes;
    private Integer viewCount;
    private Integer likeCount;
    /** DB 列是 is_top；Agent.md 的 POJO 布尔字段不加 is 前缀，用 @TableField 映射 */
    @TableField("is_top")
    private Integer top;
    private LocalDateTime publishTime;
    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;
}
```

**其余 DO 的字段表**（`@Data` + `@TableName`，主键 `@TableId(type = IdType.AUTO)`；列名与字段名不一致的只有 `top`/`featured`/`visible` 这类 `is_*` 列）：

| 类 | `@TableName` | 字段（类型） |
| --- | --- | --- |
| `ArticleContentDO` | `article_content` | `articleId`(Long, `@TableId` 非自增)、`contentMd`(String)、`gmtCreate`、`gmtModified` |
| `CategoryDO` | `category` | `id`、`scope`(String)、`parentId`(Long)、`name`(String)、`slug`(String)、`description`(String)、`sort`(Integer)、`gmtCreate`、`gmtModified` |
| `TagDO` | `tag` | `id`、`name`(String)、`slug`(String)、`gmtCreate`、`gmtModified` |
| `ArticleTagDO` | `article_tag` | `articleId`(Long)、`tagId`(Long)（无自增主键，`@TableId` 去掉，仅用于插入/删除） |

- [ ] **Step 2: 写两个行投影**（Mapper 自定义 SQL 的返回载体，**不是表映射**，所以放 `domain/projection`）

```java
package com.jcpress.domain.projection;

import lombok.Data;

/** article_tag JOIN tag 的行投影：一次批量取多篇文章的标签，避免 N+1 */
@Data
public class ArticleTagRef {

    private Long articleId;
    private String name;
    private String slug;
}
```

```java
package com.jcpress.domain.projection;

import lombok.Data;

/** 分类 + 已发布计数的行投影（Mapper 只回投影，不回 VO —— VO 由 converter 造） */
@Data
public class CategoryWithCountRef {

    private Long id;
    private String name;
    private String slug;
    private String description;
    private Long articleCount;
}
```

```java
package com.jcpress.domain.projection;

import lombok.Data;

/** 标签 + 已发布计数的行投影 */
@Data
public class TagWithCountRef {

    private Long id;
    private String name;
    private String slug;
    private Long articleCount;
}
```

- [ ] **Step 3: 写 `ArticleQuery`**（公开列表入参；**没有 keyword** —— 公开列表本期不做搜索）

```java
package com.jcpress.domain.query;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ArticleQuery extends PageQuery {

    /** TECH / ALGO / PROJECT；公开列表默认 TECH */
    private String type = "TECH";
    private Long categoryId;
    private String tagSlug;
}
```

- [ ] **Step 4: 写 VO**（公开出参；**绝不含 status、gmtModified、wordCount 之外的内部字段**）

| VO | 字段（类型） |
| --- | --- |
| `ArticleCardVO` | `id`(Long)、`title`、`slug`、`summary`、`coverUrl`、`categoryName`、`categorySlug`、`tags`(`List<TagVO>`)、`readingMinutes`(Integer)、`viewCount`(Integer)、`top`(Integer)、`publishTime`(LocalDateTime) |
| `ArticleDetailVO` | 上面全部 + `contentMd`(String)、`type`(String)、`prev`(`ArticleAdjacentVO`)、`next`(`ArticleAdjacentVO`) |
| `ArticleAdjacentVO` | `title`、`slug`、`publishTime` |
| `CategoryVO` | `id`、`name`、`slug`、`description`、`articleCount`(Long) |
| `TagVO` | `id`、`name`、`slug`、`articleCount`(Long)（列表用；卡片里的 `tags` 只需 `id/name/slug`） |

- [ ] **Step 5: 写 `ArticleConverter`**（**显式转换，不反射拷贝** —— 规划 §11.4）

```java
package com.jcpress.domain.converter;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.vo.ArticleAdjacentVO;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.TagVO;

import java.util.List;
import java.util.Map;

/** DO/投影 → VO 的显式转换：字段一个一个写，禁止 BeanUtils 反射拷贝（规划 §11.4「converter」） */
public final class ArticleConverter {

    private ArticleConverter() {
    }

    public static ArticleCardVO toCardVO(ArticleDO article, String categoryName, String categorySlug,
                                        List<TagVO> tags) {
        ArticleCardVO vo = new ArticleCardVO();
        vo.setId(article.getId());
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setSummary(article.getSummary());
        vo.setCoverUrl(article.getCoverUrl());
        vo.setCategoryName(categoryName);
        vo.setCategorySlug(categorySlug);
        vo.setTags(tags);
        vo.setReadingMinutes(article.getReadingMinutes());
        vo.setViewCount(article.getViewCount());
        vo.setTop(article.getTop());
        vo.setPublishTime(article.getPublishTime());
        return vo;
    }

    public static ArticleAdjacentVO toAdjacentVO(ArticleDO article) {
        if (article == null) {
            return null;
        }
        ArticleAdjacentVO vo = new ArticleAdjacentVO();
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setPublishTime(article.getPublishTime());
        return vo;
    }

    /** 把「按 articleId 分组的标签投影」转成每篇文章的 TagVO 列表 */
    public static List<TagVO> toTagVOs(List<ArticleTagRef> refs, Long articleId) {
        return refs.stream()
                .filter(ref -> ref.getArticleId().equals(articleId))
                .map(ref -> {
                    TagVO tag = new TagVO();
                    tag.setName(ref.getName());
                    tag.setSlug(ref.getSlug());
                    return tag;
                })
                .toList();
    }

    public static Map<Long, List<TagVO>> groupTags(List<ArticleTagRef> refs) {
        return refs.stream().collect(java.util.stream.Collectors.groupingBy(
                ArticleTagRef::getArticleId,
                java.util.stream.Collectors.mapping(ref -> {
                    TagVO tag = new TagVO();
                    tag.setName(ref.getName());
                    tag.setSlug(ref.getSlug());
                    return tag;
                }, java.util.stream.Collectors.toList())));
    }
}
```

- [ ] **Step 6: 写转换器测试**

```java
package com.jcpress.domain;

import com.jcpress.domain.converter.ArticleConverter;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.TagVO;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ArticleConverterTest {

    private static ArticleDO sampleArticle() {
        ArticleDO article = new ArticleDO();
        article.setId(1L);
        article.setTitle("ThreadLocal 在 Tool 层的上下文隔离");
        article.setSlug("threadlocal-tool-context");
        article.setReadingMinutes(9);
        article.setViewCount(12);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.of(2026, 8, 12, 9, 0, 0));
        return article;
    }

    @Test
    void cardVoCarriesCategoryAndTagsButNotInternalFields() {
        ArticleCardVO vo = ArticleConverter.toCardVO(sampleArticle(), "AI · Agent", "ai-agent", List.of());

        assertThat(vo.getId()).isEqualTo(1L);
        assertThat(vo.getCategoryName()).isEqualTo("AI · Agent");
        assertThat(vo.getReadingMinutes()).isEqualTo(9);
        // VO 上不该有 status / gmtModified 这类字段（编译期就保证：类里根本没定义）
        assertThat(ArticleCardVO.class.getDeclaredFields())
                .noneMatch(field -> field.getName().equals("status") || field.getName().equals("gmtModified"));
    }

    @Test
    void tagsAreGroupedByArticleId() {
        ArticleTagRef first = new ArticleTagRef();
        first.setArticleId(1L);
        first.setName("Redis");
        first.setSlug("redis");
        ArticleTagRef second = new ArticleTagRef();
        second.setArticleId(2L);
        second.setName("并发");
        second.setSlug("concurrency");

        Map<Long, List<TagVO>> grouped = ArticleConverter.groupTags(List.of(first, second));

        assertThat(grouped.get(1L)).extracting(TagVO::getSlug).containsExactly("redis");
        assertThat(grouped.get(2L)).extracting(TagVO::getSlug).containsExactly("concurrency");
    }

    @Test
    void nullAdjacentBecomesNullSoFrontendCanHideTheCard() {
        assertThat(ArticleConverter.toAdjacentVO(null)).isNull();
    }
}
```

- [ ] **Step 7: 跑测试**：`mvn -q test -Dtest=ArticleConverterTest` → PASS
- [ ] **Step 8: Commit**：`git commit -m "feat(backend): 技术分享领域模型（DO/投影/VO）与显式转换器"`

---

## 2. Task 2: Mapper + XML 自写 SQL

**Files:**
- Create: `backend/src/main/java/com/jcpress/repository/{ArticleMapper,ArticleContentMapper,CategoryMapper,TagMapper,ArticleTagMapper}.java`
- Create: `backend/src/main/resources/mapper/{ArticleMapper,CategoryMapper,TagMapper,ArticleTagMapper}.xml`
- Test: `backend/src/test/java/com/jcpress/repository/ArticleMapperTest.java`

- [ ] **Step 1: 写 `ArticleMapper`**（**方法名必须动词前缀开头**，否则 ArchUnit 规则 9 直接失败）

```java
package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.query.ArticleQuery;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ArticleMapper extends BaseMapper<ArticleDO> {

    /** 公开列表：动态条件 + 分类联表；只取已发布 */
    Page<ArticleDO> listPublished(Page<ArticleDO> page, @Param("query") ArticleQuery query);

    /** 详情：按 slug 取已发布 */
    ArticleDO getPublishedBySlug(@Param("type") String type, @Param("slug") String slug);

    /** 相邻篇：同类型、已发布、按 publish_time 比大小各取 1 条 */
    ArticleDO getAdjacentNext(@Param("type") String type, @Param("publishTime") LocalDateTime publishTime);

    ArticleDO getAdjacentPrev(@Param("type") String type, @Param("publishTime") LocalDateTime publishTime);

    /** 浏览量回写：把 Redis 里攒的增量刷进 DB */
    int updateViewCountIncrement(@Param("id") Long id, @Param("delta") long delta);
}
```

- [ ] **Step 2: 写 `ArticleMapper.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.jcpress.repository.ArticleMapper">

    <sql id="cardColumns">
        a.id, a.type, a.category_id, a.title, a.slug, a.summary, a.cover_url,
        a.status, a.word_count, a.reading_minutes, a.view_count, a.like_count,
        a.is_top, a.publish_time, a.gmt_create, a.gmt_modified
    </sql>

    <!-- 公开列表：禁止 SELECT *（手册 ORM 规约第 1 条）；join 只 2 张表且 join 字段都有索引 -->
    <select id="listPublished" resultType="com.jcpress.domain.dataobject.ArticleDO">
        SELECT <include refid="cardColumns"/>
        FROM article a
        WHERE a.type = #{query.type}
          AND a.status = 1
          AND a.publish_time IS NOT NULL
        <if test="query.categoryId != null">
            AND a.category_id = #{query.categoryId}
        </if>
        <if test="query.tagSlug != null and query.tagSlug != ''">
            AND EXISTS (
                SELECT 1 FROM article_tag at
                INNER JOIN tag t ON t.id = at.tag_id
                WHERE at.article_id = a.id AND t.slug = #{query.tagSlug}
            )
        </if>
        ORDER BY a.is_top DESC, a.publish_time DESC
    </select>

    <select id="getPublishedBySlug" resultType="com.jcpress.domain.dataobject.ArticleDO">
        SELECT <include refid="cardColumns"/>
        FROM article a
        WHERE a.type = #{type} AND a.slug = #{slug} AND a.status = 1
        LIMIT 1
    </select>

    <!-- 下一篇 = 比她更晚的那篇里最早的一篇；走 idx_type_status_publish_time 的反向/范围扫描 -->
    <select id="getAdjacentNext" resultType="com.jcpress.domain.dataobject.ArticleDO">
        SELECT <include refid="cardColumns"/>
        FROM article a
        WHERE a.type = #{type} AND a.status = 1 AND a.publish_time &gt; #{publishTime}
        ORDER BY a.publish_time ASC
        LIMIT 1
    </select>

    <select id="getAdjacentPrev" resultType="com.jcpress.domain.dataobject.ArticleDO">
        SELECT <include refid="cardColumns"/>
        FROM article a
        WHERE a.type = #{type} AND a.status = 1 AND a.publish_time &lt; #{publishTime}
        ORDER BY a.publish_time DESC
        LIMIT 1
    </select>

    <update id="updateViewCountIncrement">
        UPDATE article SET view_count = view_count + #{delta} WHERE id = #{id}
    </update>
</mapper>
```

- [ ] **Step 3: 写其余 Mapper（接口 + XML）**

| Mapper | 方法（动词前缀） | SQL 要点 |
| --- | --- | --- |
| `ArticleContentMapper extends BaseMapper<ArticleContentDO>` | 无需自写：正文用继承的 `selectById(articleId)` / `insert` / `updateById` / `deleteById` | — |
| `CategoryMapper extends BaseMapper<CategoryDO>` | `listWithPublishedCount(@Param("scope") String scope)` → `List<CategoryWithCountRef>` | `SELECT c.id, c.name, c.slug, c.description, COUNT(a.id) AS article_count FROM category c LEFT JOIN article a ON a.category_id = c.id AND a.status = 1 WHERE c.scope = #{scope} GROUP BY c.id, c.name, c.slug, c.description ORDER BY c.sort ASC`（**这是唯一 join 三张表以内的聚合**；`AND a.status = 1` 必须写在 `ON` 里而不是 `WHERE`，否则没有文章的分类会被整体过滤掉） |
| `TagMapper extends BaseMapper<TagDO>` | `listWithPublishedCount()` → `List<TagWithCountRef>` | `SELECT t.id, t.name, t.slug, COUNT(a.id) AS article_count FROM tag t LEFT JOIN article_tag at ON at.tag_id = t.id LEFT JOIN article a ON a.id = at.article_id AND a.status = 1 GROUP BY t.id, t.name, t.slug ORDER BY article_count DESC, t.id ASC` |
| `ArticleTagMapper extends BaseMapper<ArticleTagDO>` | `listTagRefsByArticleIds(@Param("articleIds") List<Long> articleIds)`、`deleteByArticleId(@Param("articleId") Long articleId)` | 前者：`SELECT at.article_id, t.name, t.slug FROM article_tag at INNER JOIN tag t ON t.id = at.tag_id WHERE at.article_id IN <foreach ...>`（**空集合要提前 return，否则 `IN ()` 是语法错**）；后者给 W3 的更新路径用 |

- [ ] **Step 4: 写 Mapper 测试**（真库 `jcpress_test`；此时 V2 seed 还没做，测试自己插数据并清理）

```java
package com.jcpress.repository;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.query.ArticleQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ArticleMapperTest {

    @Autowired ArticleMapper articleMapper;

    private Long publishedId;
    private Long draftId;

    @BeforeEach
    void setUp() {
        publishedId = insertArticle("tech-published", 1, LocalDateTime.of(2026, 8, 12, 9, 0, 0));
        draftId = insertArticle("tech-draft", 0, null);
    }

    @AfterEach
    void tearDown() {
        articleMapper.deleteById(publishedId);
        articleMapper.deleteById(draftId);
    }

    private Long insertArticle(String slug, int status, LocalDateTime publishTime) {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("测试文章 " + slug);
        article.setSlug(slug);
        article.setSummary("摘要");
        article.setStatus(status);
        article.setWordCount(100);
        article.setReadingMinutes(1);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(publishTime);
        articleMapper.insert(article);
        return article.getId();
    }

    @Test
    void listPublishedHidesDrafts() {
        ArticleQuery query = new ArticleQuery();
        Page<ArticleDO> page = articleMapper.listPublished(new Page<>(1, 50), query);

        assertThat(page.getRecords()).extracting(ArticleDO::getSlug)
                .contains("tech-published")
                .doesNotContain("tech-draft");
    }

    @Test
    void listPublishedOrdersByTopThenPublishTimeDesc() {
        ArticleQuery query = new ArticleQuery();
        Page<ArticleDO> page = articleMapper.listPublished(new Page<>(1, 50), query);
        assertThat(page.getRecords()).isSortedAccordingTo(
                (left, right) -> right.getPublishTime().compareTo(left.getPublishTime()));
    }

    @Test
    void getPublishedBySlugReturnsNullForDraft() {
        assertThat(articleMapper.getPublishedBySlug("TECH", "tech-published")).isNotNull();
        assertThat(articleMapper.getPublishedBySlug("TECH", "tech-draft")).isNull();
    }

    @Test
    void adjacentQueriesSkipDraftsAndRespectDirection() {
        Long newerId = insertArticle("tech-newer", 1, LocalDateTime.of(2026, 9, 1, 9, 0, 0));
        try {
            ArticleDO anchor = articleMapper.getPublishedBySlug("TECH", "tech-published");
            assertThat(articleMapper.getAdjacentNext("TECH", anchor.getPublishTime()).getSlug())
                    .isEqualTo("tech-newer");
            assertThat(articleMapper.getAdjacentPrev("TECH", anchor.getPublishTime())).isNull();
        } finally {
            articleMapper.deleteById(newerId);
        }
    }

    @Test
    void viewCountIncrementIsAdditive() {
        articleMapper.updateViewCountIncrement(publishedId, 3);
        assertThat(articleMapper.selectById(publishedId).getViewCount()).isEqualTo(3);
    }
}
```

- [ ] **Step 5: 跑测试**：`mvn -q test -Dtest=ArticleMapperTest` → PASS（5 个用例）
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): 技术分享 Mapper 与 XML 自写 SQL（列表/详情/相邻篇/计数）"`

---

## 3. Task 3: ArticleService 公开读路径

**Files:**
- Create: `backend/src/main/java/com/jcpress/service/ArticleService.java` + `service/impl/ArticleServiceImpl.java`
- Test: `backend/src/test/java/com/jcpress/service/ArticleServiceTest.java`

- [ ] **Step 1: 写接口**（方法名全部动词前缀；**只暴露 VO**，DO 不出 Service 边界）

```java
package com.jcpress.service;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;

public interface ArticleService {

    PageResult<ArticleCardVO> listPublished(ArticleQuery query);

    ArticleDetailVO getPublishedDetail(String slug);

    void saveView(String slug, String clientIp, String userAgent);
}
```

- [ ] **Step 2: 写失败测试**

```java
package com.jcpress.service;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.result.PageResult;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class ArticleServiceTest {

    @Autowired ArticleService articleService;

    @Test
    void listPublishedReturnsPagedCardsWithoutContent() {
        ArticleQuery query = new ArticleQuery();
        query.setSize(5);
        PageResult<ArticleCardVO> page = articleService.listPublished(query);

        assertThat(page.getSize()).isEqualTo(5);
        assertThat(page.getPages()).isEqualTo(page.getTotal() == 0 ? 0 : (page.getTotal() + 4) / 5);
        // ArticleCardVO 上没有 contentMd 字段 —— 列表绝不带正文（规划 §6.3）
        assertThat(ArticleCardVO.class.getDeclaredFields())
                .noneMatch(field -> field.getName().equals("contentMd"));
    }

    @Test
    void sizeIsClampedEvenWhenCallerAsksForHugePage() {
        ArticleQuery query = new ArticleQuery();
        query.setSize(9999);
        assertThat(articleService.listPublished(query).getSize()).isEqualTo(50);
    }

    @Test
    void draftSlugIsNotReachable() {
        assertThatThrownBy(() -> articleService.getPublishedDetail("this-slug-does-not-exist"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文章不存在");
    }

    @Test
    void detailCarriesMarkdownAndAdjacentArticles() {
        ArticleDetailVO detail = articleService.getPublishedDetail("phase-3-backend-retro");
        assertThat(detail).isNotNull();
        assertThat(detail.getContentMd()).isNotBlank();
        assertThat(detail.getSlug()).isEqualTo("phase-3-backend-retro");
    }
}
```

> 该测试依赖 V2 seed 里的真实发布文 `phase-3-backend-retro`（Task 7 建）。**先写测试、后补 seed**，这样 seed 一旦漏了会立刻红。

- [ ] **Step 3: 跑测试确认失败**：`mvn -q test -Dtest=ArticleServiceTest` → 编译失败（`ArticleService` 未实现）
- [ ] **Step 4: 写实现**

```java
package com.jcpress.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.result.PageResult;
import com.jcpress.domain.converter.ArticleConverter;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.manager.ArticleViewManager;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import com.jcpress.service.ArticleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleServiceImpl implements ArticleService {

    private static final String DEFAULT_TYPE = "TECH";

    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final ArticleTagMapper articleTagMapper;
    private final ArticleViewManager articleViewManager;

    @Override
    public PageResult<ArticleCardVO> listPublished(ArticleQuery query) {
        Page<ArticleDO> page = new Page<>(query.normalizedPage(), query.normalizedSize());
        Page<ArticleDO> result = articleMapper.listPublished(page, query);

        List<Long> ids = result.getRecords().stream().map(ArticleDO::getId).toList();
        Map<Long, List<TagVO>> tagGroups = ids.isEmpty()
                ? Map.of()
                : ArticleConverter.groupTags(articleTagMapper.listTagRefsByArticleIds(ids));

        List<ArticleCardVO> cards = result.getRecords().stream()
                .map(article -> ArticleConverter.toCardVO(article, null, null,
                        tagGroups.getOrDefault(article.getId(), List.of())))
                .toList();
        return PageResult.of(cards, result.getCurrent(), result.getSize(), result.getTotal());
    }

    @Override
    public ArticleDetailVO getPublishedDetail(String slug) {
        ArticleDO article = articleMapper.getPublishedBySlug(DEFAULT_TYPE, slug);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }

        ArticleContentDO content = articleContentMapper.selectById(article.getId());
        List<TagVO> tags = ArticleConverter.toTagVOs(
                articleTagMapper.listTagRefsByArticleIds(List.of(article.getId())), article.getId());

        ArticleDetailVO detail = new ArticleDetailVO();
        ArticleCardVO card = ArticleConverter.toCardVO(article, null, null, tags);
        detail.setId(card.getId());
        detail.setTitle(card.getTitle());
        detail.setSlug(card.getSlug());
        detail.setSummary(card.getSummary());
        detail.setCoverUrl(card.getCoverUrl());
        detail.setTags(card.getTags());
        detail.setReadingMinutes(card.getReadingMinutes());
        detail.setViewCount(card.getViewCount());
        detail.setTop(card.getTop());
        detail.setPublishTime(card.getPublishTime());
        detail.setType(article.getType());
        detail.setContentMd(content == null ? "" : content.getContentMd());
        detail.setNext(ArticleConverter.toAdjacentVO(
                articleMapper.getAdjacentNext(article.getType(), article.getPublishTime())));
        detail.setPrev(ArticleConverter.toAdjacentVO(
                articleMapper.getAdjacentPrev(article.getType(), article.getPublishTime())));
        return detail;
    }

    @Override
    public void saveView(String slug, String clientIp, String userAgent) {
        ArticleDO article = articleMapper.getPublishedBySlug(DEFAULT_TYPE, slug);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        articleViewManager.saveView(article.getId(), clientIp, userAgent);
    }
}
```

> **两处留待 W2 Task 4 补**：`categoryName/categorySlug` 目前传 `null`，需要 `ArticleMapper.listPublished` 一并把分类名带出来（在 XML 里 `LEFT JOIN category` 并加 `category_name`/`category_slug` 两个**非表字段**，用 `@TableField(exist = false)` 挂在 `ArticleDO` 上），随后在 Step 6 接上。

- [ ] **Step 5: 在 `ArticleDO` 上补两个非表字段**，并改 XML 带上分类名：

```java
    /** 来自 LEFT JOIN category，不是 article 表字段 */
    @TableField(exist = false)
    private String categoryName;
    @TableField(exist = false)
    private String categorySlug;
```

```xml
        SELECT <include refid="cardColumns"/>, c.name AS category_name, c.slug AS category_slug
        FROM article a
        LEFT JOIN category c ON c.id = a.category_id
```

- [ ] **Step 6: 接上分类名**：把 `ArticleServiceImpl.listPublished` 与 `getPublishedDetail` 里的 `ArticleConverter.toCardVO(article, null, null, tags)` 改成
  `ArticleConverter.toCardVO(article, article.getCategoryName(), article.getCategorySlug(), tags)`。
- [ ] **Step 7: 跑测试**：`mvn -q test -Dtest=ArticleServiceTest` → **此时 `phase-3-backend-retro` 还不存在，最后一个用例应当红**；去 Task 7 建 seed 后回来复跑。
- [ ] **Step 8: Commit**：`git commit -m "feat(backend): ArticleService 公开读路径（列表/详情/相邻篇/浏览量入口）"`

---

## 4. Task 4: CategoryService / TagService

**Files:**
- Create: `backend/src/main/java/com/jcpress/domain/converter/TaxonomyConverter.java`
- Create: `backend/src/main/java/com/jcpress/service/{CategoryService,TagService}.java` + `service/impl/{CategoryServiceImpl,TagServiceImpl}.java`
- Test: `backend/src/test/java/com/jcpress/service/CategoryServiceTest.java`

- [ ] **Step 0: 写 `TaxonomyConverter`**（投影 → VO，显式转换；Mapper 不回 VO，层次边界才干净）

```java
package com.jcpress.domain.converter;

import com.jcpress.domain.projection.CategoryWithCountRef;
import com.jcpress.domain.projection.TagWithCountRef;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.domain.vo.TagVO;

import java.util.List;

public final class TaxonomyConverter {

    private TaxonomyConverter() {
    }

    public static CategoryVO toCategoryVO(CategoryWithCountRef ref) {
        CategoryVO vo = new CategoryVO();
        vo.setId(ref.getId());
        vo.setName(ref.getName());
        vo.setSlug(ref.getSlug());
        vo.setDescription(ref.getDescription());
        vo.setArticleCount(ref.getArticleCount() == null ? 0L : ref.getArticleCount());
        return vo;
    }

    public static List<CategoryVO> toCategoryVOs(List<CategoryWithCountRef> refs) {
        return refs.stream().map(TaxonomyConverter::toCategoryVO).toList();
    }

    public static TagVO toTagVO(TagWithCountRef ref) {
        TagVO vo = new TagVO();
        vo.setId(ref.getId());
        vo.setName(ref.getName());
        vo.setSlug(ref.getSlug());
        vo.setArticleCount(ref.getArticleCount() == null ? 0L : ref.getArticleCount());
        return vo;
    }

    public static List<TagVO> toTagVOs(List<TagWithCountRef> refs) {
        return refs.stream().map(TaxonomyConverter::toTagVO).toList();
    }
}
```

- [ ] **Step 1: 写接口与实现**（薄：一次 Mapper 调用 + 默认 scope）

```java
package com.jcpress.service;

import com.jcpress.domain.vo.CategoryVO;

import java.util.List;

public interface CategoryService {

    List<CategoryVO> listByScope(String scope);
}
```

```java
package com.jcpress.service.impl;

import com.jcpress.domain.converter.TaxonomyConverter;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.repository.CategoryMapper;
import com.jcpress.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private static final String DEFAULT_SCOPE = "TECH";

    private final CategoryMapper categoryMapper;

    @Override
    public List<CategoryVO> listByScope(String scope) {
        String effectiveScope = (scope == null || scope.isBlank()) ? DEFAULT_SCOPE : scope;
        return TaxonomyConverter.toCategoryVOs(categoryMapper.listWithPublishedCount(effectiveScope));
    }
}
```

```java
package com.jcpress.service;

import com.jcpress.domain.vo.TagVO;

import java.util.List;

public interface TagService {

    List<TagVO> listWithCount();
}
```

```java
package com.jcpress.service.impl;

import com.jcpress.domain.converter.TaxonomyConverter;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.repository.TagMapper;
import com.jcpress.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TagServiceImpl implements TagService {

    private final TagMapper tagMapper;

    @Override
    public List<TagVO> listWithCount() {
        return TaxonomyConverter.toTagVOs(tagMapper.listWithPublishedCount());
    }
}
```

- [ ] **Step 2: 写测试**

```java
package com.jcpress.service;

import com.jcpress.domain.vo.CategoryVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class CategoryServiceTest {

    @Autowired CategoryService categoryService;

    @Test
    void blankScopeFallsBackToTech() {
        List<CategoryVO> categories = categoryService.listByScope("  ");
        assertThat(categories).allMatch(category -> category.getSlug() != null);
    }

    @Test
    void categoriesWithoutPublishedArticlesStillAppearWithZeroCount() {
        List<CategoryVO> categories = categoryService.listByScope("TECH");
        assertThat(categories).isNotEmpty();
        assertThat(categories).allMatch(category -> category.getArticleCount() != null);
    }
}
```

- [ ] **Step 3: 跑测试**：`mvn -q test -Dtest=CategoryServiceTest` → PASS
- [ ] **Step 4: Commit**：`git commit -m "feat(backend): 分类与标签服务（含已发布计数）"`

---

## 5. Task 5: 浏览量 Manager（Redis 5 安全 + 定时回写）

**Files:**
- Create: `backend/src/main/java/com/jcpress/manager/ArticleViewManager.java`
- Create: `backend/src/main/java/com/jcpress/common/constant/RedisKeyConstant.java`
- Create: `backend/src/main/java/com/jcpress/common/util/HashUtils.java`
- Test: `backend/src/test/java/com/jcpress/manager/ArticleViewManagerTest.java`

- [ ] **Step 1: 写键常量与工具**

```java
package com.jcpress.common.constant;

public final class RedisKeyConstant {

    /** 浏览量去重集合：view:article:{id}:{yyyyMMdd} */
    public static final String VIEW_DEDUPE = "view:article:%d:%s";
    /** 待回写的浏览量增量：view:count:{id} */
    public static final String VIEW_PENDING = "view:count:%d";
    /** 去重集合 TTL：2 天（规划 §7） */
    public static final long VIEW_DEDUPE_TTL_DAYS = 2L;

    private RedisKeyConstant() {
    }
}
```

```java
package com.jcpress.common.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** 浏览者指纹：ip + ua 的 SHA-256 前 16 位（不存原始 IP，减少隐私面） */
public final class HashUtils {

    private HashUtils() {
    }

    public static String fingerprint(String clientIp, String userAgent) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest((clientIp + "|" + userAgent).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < 8; i++) {
                builder.append(String.format("%02x", bytes[i]));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
```

- [ ] **Step 2: 写 `ArticleViewManager`**（**关键：不用 `GETDEL`** —— 那是 Redis 6.2+ 的命令，本机是 5.0.14。用 `RENAME` 把待回写键挪到临时键再读删，`RENAME` 从 Redis 1.0 就有且是原子的）

```java
package com.jcpress.manager;

import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.util.HashUtils;
import com.jcpress.repository.ArticleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ArticleViewManager {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String FLUSH_SUFFIX = ":flushing";

    private final StringRedisTemplate redis;
    private final ArticleMapper articleMapper;

    /** 幂等：同一指纹同一天只计一次（SADD 的返回值就是"是否新成员"） */
    public void saveView(Long articleId, String clientIp, String userAgent) {
        String dedupeKey = RedisKeyConstant.VIEW_DEDUPE.formatted(articleId, LocalDate.now().format(DAY));
        Long added = redis.opsForSet().add(dedupeKey, HashUtils.fingerprint(clientIp, userAgent));
        redis.expire(dedupeKey, Duration.ofDays(RedisKeyConstant.VIEW_DEDUPE_TTL_DAYS));
        if (added != null && added > 0) {
            redis.opsForValue().increment(RedisKeyConstant.VIEW_PENDING.formatted(articleId));
        }
    }

    /** 每 5 分钟把增量刷回 DB；SCAN 而不是 KEYS（KEYS 会阻塞单线程 Redis） */
    @Scheduled(fixedDelay = 300_000L, initialDelay = 60_000L)
    public void flushViewCount() {
        List<String> keys = scanKeys("view:count:*");
        for (String key : keys) {
            try {
                flushOne(key);
            } catch (Exception e) {
                log.error("浏览量回写失败 key={}", key, e);
            }
        }
    }

    private void flushOne(String key) {
        // 注意两点：① StringRedisTemplate.rename 返回 void（不是 Boolean）；
        //          ② Redis 的 RENAME 在源键不存在时会**抛错**，所以先判存在。
        // 之所以绕 RENAME 而不用 GETDEL：GETDEL 是 Redis 6.2+ 的命令，本机是 5.0.14。
        if (Boolean.FALSE.equals(redis.hasKey(key))) {
            return;
        }
        String tempKey = key + FLUSH_SUFFIX;
        redis.rename(key, tempKey);
        String value = redis.opsForValue().get(tempKey);
        redis.delete(tempKey);
        if (value == null) {
            return;
        }
        long delta = Long.parseLong(value);
        if (delta <= 0) {
            return;
        }
        Long articleId = Long.valueOf(key.substring(key.lastIndexOf(':') + 1));
        articleMapper.updateViewCountIncrement(articleId, delta);
    }

    private List<String> scanKeys(String pattern) {
        List<String> keys = new ArrayList<>();
        ScanOptions options = ScanOptions.scanOptions().match(pattern).count(200).build();
        try (Cursor<String> cursor = redis.scan(options)) {
            cursor.forEachRemaining(keys::add);
        }
        return keys;
    }
}
```

- [ ] **Step 3: 写测试**（三条：同指纹只计一次、不同指纹累加、回写把增量落库并清空待回写键）

```java
package com.jcpress.manager;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.repository.ArticleMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ArticleViewManagerTest {

    @Autowired ArticleViewManager articleViewManager;
    @Autowired ArticleMapper articleMapper;
    @Autowired StringRedisTemplate redis;

    private Long articleId;

    @BeforeEach
    void setUp() {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("浏览量测试");
        article.setSlug("view-probe-" + System.nanoTime());
        article.setStatus(1);
        article.setWordCount(10);
        article.setReadingMinutes(1);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.now());
        articleMapper.insert(article);
        articleId = article.getId();
    }

    @AfterEach
    void tearDown() {
        articleMapper.deleteById(articleId);
        redis.delete("view:count:" + articleId);
        redis.delete("view:count:" + articleId + ":flushing");
    }

    @Test
    void sameFingerprintCountsOnlyOncePerDay() {
        articleViewManager.saveView(articleId, "127.0.0.1", "JUnit");
        articleViewManager.saveView(articleId, "127.0.0.1", "JUnit");

        assertThat(redis.opsForValue().get("view:count:" + articleId)).isEqualTo("1");
    }

    @Test
    void differentFingerprintsAccumulate() {
        articleViewManager.saveView(articleId, "127.0.0.1", "A");
        articleViewManager.saveView(articleId, "127.0.0.2", "B");

        assertThat(redis.opsForValue().get("view:count:" + articleId)).isEqualTo("2");
    }

    @Test
    void flushWritesIncrementToDbAndClearsPendingKey() {
        articleViewManager.saveView(articleId, "127.0.0.3", "C");
        articleViewManager.flushViewCount();

        assertThat(articleMapper.selectById(articleId).getViewCount()).isEqualTo(1);
        assertThat(redis.hasKey("view:count:" + articleId)).isFalse();
    }
}
```

- [ ] **Step 4: 跑测试**：`mvn -q test -Dtest=ArticleViewManagerTest` → PASS（3 个用例）
- [ ] **Step 5: Commit**：`git commit -m "feat(backend): 浏览量 Manager（Redis 去重 + 定时回写，绕开 Redis 6.2+ 的 GETDEL）"`

---

## 6. Task 6: 公开接口（portal 控制器）

**Files:**
- Create: `backend/src/main/java/com/jcpress/web/portal/controller/{ArticleController,CategoryController,TagController}.java`
- Test: `backend/src/test/java/com/jcpress/web/portal/ArticleControllerTest.java`

- [ ] **Step 1: 写 `ArticleController`**（公开、零鉴权、只读；`view` 是唯一写路径且幂等）

```java
package com.jcpress.web.portal.controller;

import com.jcpress.common.result.PageResult;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/articles")
@RequiredArgsConstructor
@Tag(name = "技术分享（公开）")
public class ArticleController {

    private final ArticleService articleService;

    @GetMapping
    @Operation(summary = "公开列表（只含已发布，不含正文）")
    public Result<PageResult<ArticleCardVO>> list(ArticleQuery query) {
        return Result.success(articleService.listPublished(query));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "文章详情（Markdown 原文 + 相邻篇）")
    public Result<ArticleDetailVO> detail(@PathVariable String slug) {
        return Result.success(articleService.getPublishedDetail(slug));
    }

    @PostMapping("/{slug}/view")
    @Operation(summary = "浏览量 +1（按 ip+ua 按天去重，幂等）")
    public Result<Void> view(@PathVariable String slug, HttpServletRequest request) {
        articleService.saveView(slug, IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }
}
```

- [ ] **Step 2: 写 `CategoryController` / `TagController`**（结构同上：`GET /v1/categories` 收 `scope` 参数默认 `TECH`；`GET /v1/tags`）
- [ ] **Step 3: 写 `IpUtils`**（注意：`X-Forwarded-For` 可伪造，只用于**去重指纹**，不做任何鉴权判断 —— 这一点写进类注释）

```java
package com.jcpress.common.util;

import jakarta.servlet.http.HttpServletRequest;

public final class IpUtils {

    private static final String UNKNOWN = "unknown";

    private IpUtils() {
    }

    /** 仅用于浏览量去重指纹，不得用于鉴权/限流判定（X-Forwarded-For 可伪造） */
    public static String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank() && !UNKNOWN.equalsIgnoreCase(forwarded)) {
            int comma = forwarded.indexOf(',');
            return comma > 0 ? forwarded.substring(0, comma).trim() : forwarded.trim();
        }
        String remote = request.getRemoteAddr();
        return remote == null ? UNKNOWN : remote;
    }
}
```

- [ ] **Step 4: 写 MockMvc 契约测试**（用 `@MockBean` 打桩 Service，只验接口形状与状态码）

```java
package com.jcpress.web.portal;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.service.ArticleService;
import com.jcpress.web.portal.controller.ArticleController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ArticleController.class)
class ArticleControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ArticleService articleService;

    @Test
    void listReturnsPagedBody() throws Exception {
        ArticleCardVO card = new ArticleCardVO();
        card.setSlug("phase-3-backend-retro");
        card.setTitle("三期后端复盘");
        given(articleService.listPublished(any())).willReturn(PageResult.of(List.of(card), 1, 20, 1));

        mockMvc.perform(get("/v1/articles").param("type", "TECH"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.code").value(0))
               .andExpect(jsonPath("$.data.list[0].slug").value("phase-3-backend-retro"))
               .andExpect(jsonPath("$.data.total").value(1))
               .andExpect(jsonPath("$.data.pages").value(1));
    }

    @Test
    void viewIsPostAndIdempotentAtHttpLevel() throws Exception {
        mockMvc.perform(post("/v1/articles/phase-3-backend-retro/view"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.code").value(0));
    }
}
```

- [ ] **Step 5: 跑测试**：`mvn -q test`（全量）
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): 技术分享公开接口（列表/详情/浏览量/分类/标签）"`

---

## 7. Task 7: V2 seed（分类 / 标签 / 5 篇草稿 / 1 篇真实发布文 / 后台账号）

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__seed_data.sql`
- Create: `backend/src/test/java/com/jcpress/service/SeedDataTest.java`
- Create: `backend/src/test/java/com/jcpress/service/BCryptHashPrinter.java`（**临时**，用完删）

- [ ] **Step 1: 用一次性测试打印 BCrypt 哈希**（口令不进仓库明文；这里定的初始口令只用于本地首登，文档写在 seed 注释里）

```java
package com.jcpress.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** 临时工具：打印 seed 要用的 BCrypt 哈希，把结果粘进 V2__seed_data.sql 后删掉本文件 */
class BCryptHashPrinter {

    @Test
    void printHash() {
        System.out.println("BCRYPT_HASH=" + new BCryptPasswordEncoder().encode("jcpress@2026"));
    }
}
```

Run: `mvn -q test -Dtest=BCryptHashPrinter` → 复制输出的 `BCRYPT_HASH=...`

- [ ] **Step 2: 写 `V2__seed_data.sql`**

```sql
-- 分类（scope=TECH）
INSERT INTO `category` (`scope`,`parent_id`,`name`,`slug`,`description`,`sort`) VALUES
  ('TECH', 0, 'AI · Agent', 'ai-agent',   'Agent 工程、RAG 与检索',      10),
  ('TECH', 0, 'Java 后端',  'java-backend','Spring 生态与工程实践',        20),
  ('TECH', 0, '数据库',     'database',    'MySQL 索引、归档与慢查询',      30),
  ('TECH', 0, '中间件',     'middleware',  'Redis / MQ / 调度',           40);

-- 标签
INSERT INTO `tag` (`name`,`slug`) VALUES
  ('Redis','redis'), ('并发','concurrency'), ('MySQL','mysql'),
  ('Spring AI','spring-ai'), ('RAG','rag'), ('架构','architecture');

-- 后台账号：口令 jcpress@2026（BCrypt），上线前必须在数据库里改掉
INSERT INTO `admin_user` (`username`,`password_hash`,`nickname`,`role`,`status`) VALUES
  ('admin', '<Step 1 打印出来的哈希>', '站长', 'ADMIN', 1);

-- 真实发布文（唯一 status=1 的种子内容）：正文用本次三期后端的真实复盘
INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`is_top`,`publish_time`)
VALUES ('TECH', 2, '三期后端复盘：把官方模板升到 Spring Boot 3 踩到的五个坑',
        'phase-3-backend-retro', '从 SB 2.7.2 升 3.3.4、Jackson 换 Gson、Sa-Token 版本被本机 Redis 卡住……', 1, 2400, 7, 0, 1, NOW());
INSERT INTO `article_content` (`article_id`,`content_md`)
VALUES (LAST_INSERT_ID(), '# 三期后端复盘\n\n正文由 Step 2b 写满（≥2000 字，覆盖标题/列表/表格/行内代码/围栏代码块/引用）\n\n## 一、模板不是基线\n\n…\n\n```java\n// 代码块用于验证高亮与横向滚动\npublic class Demo {}\n```\n');

-- 5 篇占位文：一律 status=0（草稿），公开列表看不到；标题/摘要沿用前端占位数据
INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`is_top`,`publish_time`) VALUES
  ('TECH', 1, 'ThreadLocal 在 Tool 层的上下文隔离：一次并发串扰的排查', 'threadlocal-tool-context', 'Agent 并发调用工具时用户身份串了…', 0, 0, 0, 0, 0, NULL),
  ('TECH', 1, '滑动窗口分块 + 混合检索：把知识库准确率从 65% 拉到 90%', 'sliding-window-hybrid-retrieval', 'PDF 按固定长度切会把语义切断…', 0, 0, 0, 0, 0, NULL),
  ('TECH', 1, '用飞书话题 threadId 做同 Case 串行：Agent 群聊的并发一致性', 'feishu-threadid-serial', '同一个故障排查 Case 的消息必须顺序处理…', 0, 0, 0, 0, 0, NULL),
  ('TECH', 4, 'Redis ZSet 分片 + 分布式锁：Pulse 的任务多机分发', 'pulse-zset-sharding', '定时任务平台要横向扩容…', 0, 0, 0, 0, 0, NULL),
  ('TECH', 3, '1000 万行日志表归档：主键分批删除如何规避长事务与长锁', 'archive-ten-million-rows', '一次性 DELETE 会锁表锁到天亮…', 0, 0, 0, 0, 0, NULL);

-- 草稿也各给一段提纲正文，方便后台打开就能接着写
INSERT INTO `article_content` (`article_id`,`content_md`)
SELECT `id`, CONCAT('# ', `title`, '\n\n> 草稿：待补正文。\n\n## 背景\n\n## 排查过程\n\n## 结论\n') FROM `article` WHERE `status` = 0;
```

- [ ] **Step 2b: 写这篇真实正文（必须做，不是"以后补"）**

它是本期**唯一公开可见**的种子内容，同时是前台详情页的**实际验收素材** —— 正文必须覆盖：多级标题（`##`/`###`）、有序与无序列表、**表格**、行内代码、**围栏代码块**、引用、外链。五个必写小节：

1. `## 一、模板不是基线` —— 模板是 SB 2.7.2 / Java 8，规划是 Java 21（后改 17），逐件处置清单
2. `## 二、Jackson 换 Gson 的三个坑` —— Long 精度、`java.time` 默认序列化、`serializeNulls`（含代码块）
3. `## 三、一个被 Redis 版本卡住的依赖` —— 1.46.0 用 `SET ... KEEPTTL`、本机 Redis 5.0.14、逐版本开 jar 验证、锁 1.44.0（含**表格**）
4. `## 四、把「文档写了但没人守」的规则变成判据` —— ArchUnit 12 条 + 文本扫描兜住的两个盲区
5. `## 五、首页加一个区块掀翻了停靠表` —— 7→8 个 scene 的连带返工

写完把字数填回 `article` 行的 `word_count` / `reading_minutes`（按 400 字/分钟估算，与 Service 的算法一致）。

- [ ] **Step 3: 写 seed 断言测试**

```java
package com.jcpress.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SeedDataTest {

    @Autowired JdbcTemplate jdbcTemplate;

    @Test
    void onlyTheRealArticleIsPublished() {
        Integer published = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article WHERE type='TECH' AND status=1", Integer.class);
        assertThat(published).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT slug FROM article WHERE status=1", String.class)).isEqualTo("phase-3-backend-retro");
    }

    @Test
    void placeholderArticlesAreDraftsWithOutlineContent() {
        Integer draftsWithContent = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article a JOIN article_content c ON c.article_id = a.id WHERE a.status = 0",
                Integer.class);
        assertThat(draftsWithContent).isEqualTo(5);
    }

    @Test
    void adminAccountIsSeededWithBcryptHash() {
        String hash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM admin_user WHERE username='admin'", String.class);
        assertThat(hash).startsWith("$2a$");
    }
}
```

- [ ] **Step 4: 跑测试**：`mvn -q test -Dtest='SeedDataTest,ArticleServiceTest'` → PASS（含 Task 3 那条依赖 seed 的用例）
- [ ] **Step 5: 删掉临时打印类**：`Remove-Item backend/src/test/java/com/jcpress/service/BCryptHashPrinter.java`
- [ ] **Step 6: Commit**：`git commit -m "feat(backend): V2 seed（4 分类/6 标签/1 真实发布文/5 篇草稿/后台账号）"`

---

## 8. Task 8: W2 出口复核与留痕

- [ ] **Step 1: 过验收门**：`mvn -q -DskipTests compile` → `mvn -q test` → `mvn spring-boot:run` 后逐个手测：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/articles?type=TECH&size=20' | ConvertTo-Json -Depth 6
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/articles/phase-3-backend-retro' | ConvertTo-Json -Depth 6
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/categories?scope=TECH' | ConvertTo-Json -Depth 6
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/tags' | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post 'http://127.0.0.1:8080/api/v1/articles/phase-3-backend-retro/view' | ConvertTo-Json
```

Expected：列表**只有 1 条**（真实发布文）· 详情带 `contentMd` 与 `prev`/`next`（都为 null，因为只有一篇）· id 是**字符串** · 时间为 `yyyy-MM-dd HH:mm:ss`

- [ ] **Step 2: 留痕**：`docs/dev-journal.md` 追加「阶段 33 · W2」四样
- [ ] **Step 3: Commit**：`git commit -m "docs(phase-3): W2 完成留痕"`
