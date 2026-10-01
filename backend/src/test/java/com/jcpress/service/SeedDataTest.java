package com.jcpress.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V2 种子数据的验收。
 *
 * 重点不在"有几行"，而在两件事：
 * 1. **占位文案不许被当成成品发出去** —— 那 5 篇必须是草稿，公开列表看不到。
 * 2. **唯一那篇已发布文要能撑起详情页的验收** —— 正文必须覆盖表格、围栏代码块、引用、外链、
 *    列表、行内代码，否则前端的渲染管线就没有真实素材可测。
 */
@SpringBootTest
@ActiveProfiles("test")
class SeedDataTest {

    private static final String REAL_ARTICLE = "phase-3-backend-retro";
    private static final List<String> PLACEHOLDER_SLUGS = List.of(
            "threadlocal-tool-context",
            "sliding-window-hybrid-retrieval",
            "feishu-threadid-serial",
            "pulse-zset-sharding",
            "archive-ten-million-rows");

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Test
    void exactlyOneArticleIsPublishedAndItIsTheRealOne() {
        List<String> published = jdbcTemplate.queryForList(
                "SELECT slug FROM article WHERE type = 'TECH' AND status = 1", String.class);

        assertThat(published).containsExactly(REAL_ARTICLE);
    }

    @Test
    void placeholderArticlesAreDraftsAndInvisibleToPublicList() {
        Integer drafts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article WHERE status = 0 AND slug IN (?,?,?,?,?)",
                Integer.class, PLACEHOLDER_SLUGS.toArray());

        assertThat(drafts).isEqualTo(5);

        // 公开列表口径 = status 1 且 publish_time 非空：草稿一条都不该出现
        List<String> publicSlugs = jdbcTemplate.queryForList(
                "SELECT slug FROM article WHERE type = 'TECH' AND status = 1 AND publish_time IS NOT NULL",
                String.class);
        assertThat(publicSlugs).doesNotContainAnyElementsOf(PLACEHOLDER_SLUGS);
    }

    @Test
    void realArticleBodyCoversEverythingTheDetailPageNeedsToRender() {
        String body = jdbcTemplate.queryForObject(
                "SELECT c.content_md FROM article_content c JOIN article a ON a.id = c.article_id WHERE a.slug = ?",
                String.class, REAL_ARTICLE);

        assertThat(body).isNotNull();
        assertThat(body.length()).as("正文长度要够撑起长文排版").isGreaterThan(2000);
        assertThat(body).contains("## ");          // 二级标题（章节自动编号依赖它）
        assertThat(body).contains("| --- |");      // 表格
        assertThat(body).contains("```java");      // 围栏代码块（带语言，用于高亮）
        assertThat(body).contains("> ");           // 引用
        assertThat(body).contains("](https://");   // 外链
        assertThat(body).contains("`Agent.md`");   // 行内代码
        assertThat(body).contains("- **");         // 无序列表
    }

    @Test
    void realArticleIsLinkedToThreeTags() {
        Integer tagCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article_tag at JOIN article a ON a.id = at.article_id WHERE a.slug = ?",
                Integer.class, REAL_ARTICLE);

        assertThat(tagCount).isEqualTo(3);
    }

    @Test
    void draftsHaveOutlineContentSoTheyCanBeContinued() {
        Integer draftsWithContent = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article a JOIN article_content c ON c.article_id = a.id "
                        + "WHERE a.status = 0 AND c.content_md LIKE '%草稿：待补正文%'",
                Integer.class);

        assertThat(draftsWithContent).isEqualTo(5);
    }

    @Test
    void adminAccountIsSeededWithRealBcryptHash() {
        String hash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM admin_user WHERE username = 'admin'", String.class);

        // $2a$ 是 BCrypt 的标识；手写一个"看起来像"的哈希会让首登永远失败
        assertThat(hash).startsWith("$2a$").hasSize(60);
    }

    @Test
    void categoriesAndTagsAreSeeded() {
        Integer categories = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM category WHERE scope = 'TECH'", Integer.class);
        Integer tags = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tag", Integer.class);

        assertThat(categories).isGreaterThanOrEqualTo(4);
        assertThat(tags).isGreaterThanOrEqualTo(8);
    }
}
