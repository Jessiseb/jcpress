package com.jcpress.importer;

import com.jcpress.repository.ArticleContentMapper;
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

/**
 * 导入器。
 *
 * 重点验的是**"校验失败整批回滚"**：它靠"两段式"实现 —— 第一段只读校验、第二段单事务落库。
 * 所以坏文件在 prepare() 阶段就抛出，**库中一个字节都不会变**。
 */
@SpringBootTest
@ActiveProfiles("test")
class MarkdownImporterTest {

    private static final String SLUG_A = "importer-probe-a";
    private static final String SLUG_B = "importer-probe-b";

    @Autowired
    MarkdownImporter markdownImporter;

    @Autowired
    ArticleMapper articleMapper;

    @Autowired
    ArticleContentMapper articleContentMapper;

    @TempDir
    Path tempDir;

    private void write(String name, String content) throws IOException {
        Files.writeString(tempDir.resolve(name), content, StandardCharsets.UTF_8);
    }

    private String doc(String slug, String category, String status) {
        return """
                ---
                title: 导入器测试文 %s
                slug: %s
                type: TECH
                category: %s
                tags: [Redis, 并发]
                summary: 导入器测试用的摘要
                status: %s
                ---

                # 标题

                正文用于验证幂等导入，共若干字。
                """.formatted(slug, slug, category, status);
    }

    private void cleanUp() {
        for (String slug : List.of(SLUG_A, SLUG_B)) {
            var existing = articleMapper.getByTypeAndSlug("TECH", slug);
            if (existing != null) {
                articleContentMapper.deleteById(existing.getId());
                articleMapper.deleteById(existing.getId());
            }
        }
    }

    @Test
    void firstImportCreatesThenSecondImportUpdates() throws Exception {
        write("a.md", doc(SLUG_A, "java-backend", "DRAFT"));
        try {
            ImportReport first = markdownImporter.importItems(markdownImporter.prepare(tempDir));
            assertThat(first.created()).isEqualTo(1);
            assertThat(first.updated()).isZero();

            ImportReport second = markdownImporter.importItems(markdownImporter.prepare(tempDir));
            assertThat(second.created()).isZero();
            assertThat(second.updated()).isEqualTo(1);

            // 幂等：仍然只有一篇文章，且正文是最新的一份
            var article = articleMapper.getByTypeAndSlug("TECH", SLUG_A);
            assertThat(articleContentMapper.selectById(article.getId()).getContentMd())
                    .contains("正文用于验证幂等导入");
            assertThat(article.getWordCount()).isGreaterThan(0);
        } finally {
            cleanUp();
        }
    }

    @Test
    void badFileStopsTheWholeBatchBeforeAnythingIsWritten() throws Exception {
        write("good.md", doc(SLUG_A, "java-backend", "DRAFT"));
        write("bad.md", doc(SLUG_B, "no-such-category", "DRAFT"));

        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("分类不存在")
                .hasMessageContaining("bad.md");

        // 关键断言：合法那篇也没有被写进去
        assertThat(articleMapper.getByTypeAndSlug("TECH", SLUG_A)).isNull();
    }

    @Test
    void missingFrontMatterIsRejectedWithFileName() throws Exception {
        write("plain.md", "# 没有 front-matter\n");

        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("plain.md")
                .hasMessageContaining("front-matter");
    }

    @Test
    void invalidSlugIsRejectedWithFileName() throws Exception {
        write("bad-slug.md", doc("Bad_Slug", "java-backend", "DRAFT"));

        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("bad-slug.md")
                .hasMessageContaining("slug");
    }

    @Test
    void emptyDirectoryIsRejected() {
        assertThatThrownBy(() -> markdownImporter.prepare(tempDir))
                .isInstanceOf(ImportException.class)
                .hasMessageContaining("没有 .md 文件");
    }

    @Test
    void publishedArticleWithoutPublishTimeStillBecomesVisible() throws Exception {
        write("published.md", doc(SLUG_A, "java-backend", "PUBLISHED"));
        try {
            markdownImporter.importItems(markdownImporter.prepare(tempDir));

            var article = articleMapper.getByTypeAndSlug("TECH", SLUG_A);
            assertThat(article.getStatus()).isEqualTo(1);
            // 公开列表要求 publish_time IS NOT NULL —— 没给时间时必须兜底
            assertThat(article.getPublishTime()).isNotNull();
        } finally {
            cleanUp();
        }
    }
}
