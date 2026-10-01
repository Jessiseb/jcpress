package com.jcpress.importer;

import com.jcpress.common.util.WordCountUtils;
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
import java.util.stream.Stream;

/**
 * Markdown 导入器。
 *
 * **两段式**，这是"校验失败整批回滚"能成立的关键：
 * 1. {@link #prepare(Path)}：只读、只解析、只校验 —— 任何一个文件不合法都在这里抛出，
 *    此时**一个字节都还没写库**；
 * 2. {@link #importItems(List)}：全部通过之后，在**单个事务**内落库。
 *
 * 这样就不会出现"前几个文件已写入、后面的文件失败"的半成品状态，
 * 也不需要依赖数据库事务回滚来兜输入错误。
 *
 * 幂等键是 `(type, slug)`；**永不删除**已发布内容（目录里少了一个文件不代表要删库）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MarkdownImporter {

    private static final DateTimeFormatter PUBLISH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final FrontMatterParser parser;
    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final CategoryMapper categoryMapper;

    /** 第一段：只读准备。任何输入问题都在这里抛出，此时尚未写库 */
    public List<ImportItem> prepare(Path directory) throws IOException {
        if (!Files.isDirectory(directory)) {
            throw new ImportException("不是一个目录：" + directory);
        }

        List<Path> files;
        try (Stream<Path> stream = Files.walk(directory)) {
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
            FrontMatterParser.ParsedMarkdown parsed =
                    parser.parse(raw, file.getFileName().toString());
            Long categoryId = resolveCategoryId(parsed.frontMatter(), file);
            ArticleDO existing = articleMapper.getByTypeAndSlug(
                    parsed.frontMatter().getType(), parsed.frontMatter().getSlug());
            items.add(new ImportItem(file, parsed.frontMatter(), parsed.body(), categoryId, existing));
        }
        log.info("导入准备完成：{} 个文件（新增 {} / 更新 {}）", items.size(),
                items.stream().filter(ImportItem::isNew).count(),
                items.stream().filter(item -> !item.isNew()).count());
        return items;
    }

    /** 第二段：单事务落库（按 (type, slug) 幂等 upsert） */
    @Transactional
    public ImportReport importItems(List<ImportItem> items) {
        int created = 0;
        int updated = 0;
        for (ImportItem item : items) {
            if (item.isNew()) {
                saveNew(item);
                created++;
            } else {
                updateExisting(item);
                updated++;
            }
        }
        ImportReport report = new ImportReport(created, updated, 0, List.of());
        log.info("导入完成：{}", report.render().replace("\n", " "));
        return report;
    }

    private void saveNew(ImportItem item) {
        ArticleDO article = buildArticle(item);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        // 已发布但 front-matter 没给时间时兜底为 now()：
        // 公开列表要求 publish_time IS NOT NULL，否则这篇会"发布了但看不见"
        LocalDateTime publishTime = parsePublishTime(item.frontMatter());
        article.setPublishTime(article.getStatus() == 1
                ? (publishTime == null ? LocalDateTime.now() : publishTime)
                : publishTime);
        articleMapper.insert(article);

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(article.getId());
        content.setContentMd(item.body());
        articleContentMapper.insert(content);
    }

    private void updateExisting(ImportItem item) {
        ArticleDO article = buildArticle(item);
        article.setId(item.existing().getId());
        if (article.getStatus() == 1 && item.existing().getPublishTime() == null) {
            LocalDateTime publishTime = parsePublishTime(item.frontMatter());
            article.setPublishTime(publishTime == null ? LocalDateTime.now() : publishTime);
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
    }

    private ArticleDO buildArticle(ImportItem item) {
        FrontMatter frontMatter = item.frontMatter();
        int wordCount = WordCountUtils.count(item.body());

        ArticleDO article = new ArticleDO();
        article.setType(frontMatter.getType());
        article.setTitle(frontMatter.getTitle());
        article.setSlug(frontMatter.getSlug());
        article.setSummary(frontMatter.getSummary());
        article.setCoverUrl(frontMatter.getCover());
        article.setCategoryId(item.categoryId());
        article.setWordCount(wordCount);
        article.setReadingMinutes(WordCountUtils.estimateReadingMinutes(wordCount));
        article.setStatus(mapStatus(frontMatter.getStatus()));
        return article;
    }

    private Long resolveCategoryId(FrontMatter frontMatter, Path file) {
        CategoryDO category = categoryMapper.getByScopeAndSlug(
                mapCategoryScope(frontMatter.getType()), frontMatter.getCategory());
        if (category == null) {
            throw new ImportException(file.getFileName() + "：分类不存在 category="
                    + frontMatter.getCategory());
        }
        return category.getId();
    }

    /** 分类树按 scope 分（TECH / ALGO）；PROJECT 类型没有分类树，走 TECH 兜底 */
    private String mapCategoryScope(String type) {
        return "ALGO".equals(type) ? "ALGO" : "TECH";
    }

    private int mapStatus(String status) {
        return switch (status) {
            case "PUBLISHED" -> 1;
            case "ARCHIVED" -> 2;
            default -> 0;
        };
    }

    private LocalDateTime parsePublishTime(FrontMatter frontMatter) {
        String value = frontMatter.getPublishTime();
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, PUBLISH_TIME);
        } catch (RuntimeException e) {
            throw new ImportException("publishTime 格式应为 yyyy-MM-dd HH:mm:ss，实际为 " + value);
        }
    }
}
