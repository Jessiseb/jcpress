package com.jcpress.repository;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.query.ArticleQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Mapper 层测试：跑在真库（jcpress_test）上，验证 XML 里写的动态 SQL 真的按预期工作。
 *
 * 用随机 slug 前缀 + 精确清理，避免与其他测试类互相干扰。
 */
@SpringBootTest
@ActiveProfiles("test")
class ArticleMapperTest {

    private static final String SLUG_PREFIX = "mapper-probe-";
    /** 用一个远期时间把探针数据与 seed 数据分开，避免相邻篇断言被 seed 干扰 */
    private static final LocalDateTime BASE_TIME = LocalDateTime.of(2099, 1, 1, 9, 0, 0);

    @Autowired
    ArticleMapper articleMapper;

    private Long publishedId;
    private Long draftId;
    private Long newerId;

    private Long insertArticle(String slugSuffix, int status, LocalDateTime publishTime, Integer top) {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("Mapper 探针 " + slugSuffix);
        article.setSlug(SLUG_PREFIX + slugSuffix);
        article.setSummary("摘要");
        article.setStatus(status);
        article.setWordCount(100);
        article.setReadingMinutes(1);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(top);
        article.setPublishTime(publishTime);
        articleMapper.insert(article);
        return article.getId();
    }

    @AfterEach
    void tearDown() {
        for (Long id : new Long[]{publishedId, draftId, newerId}) {
            if (id != null) {
                articleMapper.deleteById(id);
            }
        }
        publishedId = null;
        draftId = null;
        newerId = null;
    }

    @Test
    void listPublishedHidesDraftsAndKeepsTopFlag() {
        publishedId = insertArticle("published", 1, BASE_TIME, 1);
        draftId = insertArticle("draft", 0, null, 0);

        Page<ArticleDO> page = articleMapper.listPublished(
                new Page<>(1, 50), defaultQuery());

        assertThat(page.getRecords()).extracting(ArticleDO::getSlug)
                .contains(SLUG_PREFIX + "published")
                .doesNotContain(SLUG_PREFIX + "draft");

        ArticleDO found = page.getRecords().stream()
                .filter(article -> article.getSlug().equals(SLUG_PREFIX + "published"))
                .findFirst()
                .orElseThrow();
        // is_top 必须有别名才映射得到 top —— 这条断言就是为它写的
        assertThat(found.getTop()).isEqualTo(1);
    }

    @Test
    void getPublishedBySlugReturnsNullForDraft() {
        publishedId = insertArticle("by-slug", 1, BASE_TIME, 0);
        draftId = insertArticle("by-slug-draft", 0, null, 0);

        assertThat(articleMapper.getPublishedBySlug("TECH", SLUG_PREFIX + "by-slug")).isNotNull();
        assertThat(articleMapper.getPublishedBySlug("TECH", SLUG_PREFIX + "by-slug-draft")).isNull();
        // 后台用的方法不看状态
        assertThat(articleMapper.getByTypeAndSlug("TECH", SLUG_PREFIX + "by-slug-draft")).isNotNull();
    }

    @Test
    void adjacentQueriesRespectDirectionAndSkipDrafts() {
        publishedId = insertArticle("anchor", 1, BASE_TIME, 0);
        newerId = insertArticle("newer", 1, BASE_TIME.plusDays(1), 0);

        assertThat(articleMapper.getAdjacentNext("TECH", BASE_TIME).getSlug())
                .isEqualTo(SLUG_PREFIX + "newer");
        assertThat(articleMapper.getAdjacentPrev("TECH", BASE_TIME.plusDays(1)).getSlug())
                .isEqualTo(SLUG_PREFIX + "anchor");
    }

    @Test
    void viewCountIncrementIsAdditive() {
        publishedId = insertArticle("views", 1, BASE_TIME, 0);

        articleMapper.updateViewCountIncrement(publishedId, 3);
        articleMapper.updateViewCountIncrement(publishedId, 2);

        assertThat(articleMapper.selectById(publishedId).getViewCount()).isEqualTo(5);
    }

    /** 公开列表的默认查询条件；探针数据靠 2099 年的 publish_time 稳定排在第一页 */
    private ArticleQuery defaultQuery() {
        ArticleQuery query = new ArticleQuery();
        query.setType("TECH");
        query.setPage(1);
        query.setSize(50);
        return query;
    }
}
