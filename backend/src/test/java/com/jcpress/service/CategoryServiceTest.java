package com.jcpress.service;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.CategoryDO;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.CategoryMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 分类服务。重点验证两件事：空 scope 回退 TECH；**没有已发布文章的分类也要出现且计数为 0**
 * （计数条件写在 LEFT JOIN 的 ON 里而不是 WHERE，就是为它）。
 */
@SpringBootTest
@ActiveProfiles("test")
class CategoryServiceTest {

    private static final String CATEGORY_WITH_ARTICLE = "category-probe-with-article";
    private static final String CATEGORY_WITHOUT_ARTICLE = "category-probe-empty";

    @Autowired
    CategoryService categoryService;

    @Autowired
    CategoryMapper categoryMapper;

    @Autowired
    ArticleMapper articleMapper;

    private Long withArticleId;
    private Long emptyId;
    private Long articleId;

    @BeforeEach
    void setUp() {
        withArticleId = insertCategory(CATEGORY_WITH_ARTICLE, "有文章的探针分类");
        emptyId = insertCategory(CATEGORY_WITHOUT_ARTICLE, "没文章的探针分类");

        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setCategoryId(withArticleId);
        article.setTitle("分类探针文章");
        article.setSlug("category-probe-article");
        article.setStatus(1);
        article.setWordCount(10);
        article.setReadingMinutes(1);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.of(2096, 6, 1, 9, 0));
        articleMapper.insert(article);
        articleId = article.getId();
    }

    @AfterEach
    void tearDown() {
        if (articleId != null) {
            articleMapper.deleteById(articleId);
        }
        if (withArticleId != null) {
            categoryMapper.deleteById(withArticleId);
        }
        if (emptyId != null) {
            categoryMapper.deleteById(emptyId);
        }
    }

    private Long insertCategory(String slug, String name) {
        CategoryDO category = new CategoryDO();
        category.setScope("TECH");
        category.setParentId(0L);
        category.setName(name);
        category.setSlug(slug);
        category.setSort(999);
        categoryMapper.insert(category);
        return category.getId();
    }

    @Test
    void blankScopeFallsBackToTech() {
        List<CategoryVO> categories = categoryService.listByScope("   ");

        assertThat(categories).extracting(CategoryVO::getSlug).contains(CATEGORY_WITH_ARTICLE);
    }

    @Test
    void categoryWithoutPublishedArticleStillAppearsWithZeroCount() {
        List<CategoryVO> categories = categoryService.listByScope("TECH");

        CategoryVO empty = categories.stream()
                .filter(item -> CATEGORY_WITHOUT_ARTICLE.equals(item.getSlug()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("没有文章的分类也必须出现"));
        assertThat(empty.getArticleCount()).isZero();

        CategoryVO withArticle = categories.stream()
                .filter(item -> CATEGORY_WITH_ARTICLE.equals(item.getSlug()))
                .findFirst()
                .orElseThrow();
        assertThat(withArticle.getArticleCount()).isEqualTo(1L);
    }

    @Test
    void otherScopeDoesNotLeakIntoResult() {
        List<CategoryVO> categories = categoryService.listByScope("ALGO");

        assertThat(categories).extracting(CategoryVO::getSlug)
                .doesNotContain(CATEGORY_WITH_ARTICLE, CATEGORY_WITHOUT_ARTICLE);
    }
}
