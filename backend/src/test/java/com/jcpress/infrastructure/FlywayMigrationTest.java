package com.jcpress.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 迁移验证：V1 的表必须真的建成，而且 ngram 全文索引要**可查询**（不只是能建）。
 *
 * 这两条都已用探针在 MySQL 8.0.36 上预验证过（docs/design-tech-module.md §6），
 * 这里把它固化成回归判据。
 */
@SpringBootTest
@ActiveProfiles("test")
class FlywayMigrationTest {

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Test
    void allArticleModuleTablesExist() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
                String.class);

        assertThat(tables).contains(
                "article", "article_content", "category", "tag", "article_tag",
                "admin_user", "admin_audit_log");
    }

    @Test
    void ngramFulltextIndexIsQueryable() {
        Integer hit = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article WHERE MATCH(title, summary) AGAINST('分片' IN BOOLEAN MODE)",
                Integer.class);

        assertThat(hit).isNotNull();
    }

    @Test
    void articleTableHasNoLogicDeleteColumn() {
        // 反证「不要照抄模板的 logic-delete-field」这条：表里根本没有 is_delete
        Integer columns = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'article' AND column_name = 'is_delete'",
                Integer.class);

        assertThat(columns).isZero();
    }
}
