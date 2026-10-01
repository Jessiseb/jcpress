package com.jcpress.service;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.result.PageResult;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.ArticleTagDO;
import com.jcpress.domain.dataobject.TagDO;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import com.jcpress.repository.TagMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 公开读路径。
 *
 * **自给自足**：数据在测试里造、测试里清，不依赖 V2 seed —— 这样测试与内容解耦，
 * 也不会出现"seed 还没写所以测试先红一段"的窗口。（seed 正确性另有 SeedDataTest 兜。）
 * 时间用 2098/2097 年，保证探针数据稳定排在公开列表第一页、且相邻篇不被其他数据干扰。
 */
@SpringBootTest
@ActiveProfiles("test")
class ArticleServiceTest {

    private static final String SINGLE = "service-probe-single";
    private static final String OLDER = "service-probe-older";
    private static final String TAG_SLUG = "service-probe-tag";

    @Autowired
    ArticleService articleService;

    @Autowired
    ArticleMapper articleMapper;

    @Autowired
    ArticleContentMapper articleContentMapper;

    @Autowired
    ArticleTagMapper articleTagMapper;

    @Autowired
    TagMapper tagMapper;

    private Long singleId;
    private Long olderId;
    private Long tagId;

    @BeforeEach
    void setUp() {
        tagId = insertTag();
        olderId = insertArticle(OLDER, 1, LocalDateTime.of(2097, 12, 31, 9, 0));
        singleId = insertArticle(SINGLE, 1, LocalDateTime.of(2098, 1, 1, 9, 0));

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(singleId);
        content.setContentMd("# 探针标题\n\n正文用于验证 Markdown 原样下发。");
        articleContentMapper.insert(content);

        ArticleTagDO relation = new ArticleTagDO();
        relation.setArticleId(singleId);
        relation.setTagId(tagId);
        articleTagMapper.insert(relation);
    }

    @AfterEach
    void tearDown() {
        for (Long id : new Long[]{singleId, olderId}) {
            if (id != null) {
                articleTagMapper.deleteByArticleId(id);
                articleContentMapper.deleteById(id);
                articleMapper.deleteById(id);
            }
        }
        if (tagId != null) {
            tagMapper.deleteById(tagId);
        }
    }

    private Long insertTag() {
        TagDO existing = tagMapper.getBySlug(TAG_SLUG);
        if (existing != null) {
            return existing.getId();
        }
        TagDO tag = new TagDO();
        tag.setName("服务探针标签");
        tag.setSlug(TAG_SLUG);
        tagMapper.insert(tag);
        return tag.getId();
    }

    private Long insertArticle(String slug, int status, LocalDateTime publishTime) {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("服务探针 " + slug);
        article.setSlug(slug);
        article.setSummary("摘要");
        article.setStatus(status);
        article.setWordCount(20);
        article.setReadingMinutes(1);
        article.setViewCount(7);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(publishTime);
        articleMapper.insert(article);
        return article.getId();
    }

    @Test
    void listPublishedReturnsCardsWithTagsButWithoutContent() {
        ArticleQuery query = new ArticleQuery();
        query.setPage(1);
        query.setSize(50);

        PageResult<ArticleCardVO> page = articleService.listPublished(query);

        ArticleCardVO card = page.getList().stream()
                .filter(item -> SINGLE.equals(item.getSlug()))
                .findFirst()
                .orElseThrow();
        assertThat(card.getTags()).extracting("slug").containsExactly(TAG_SLUG);
        assertThat(card.getViewCount()).isEqualTo(7);
        assertThat(page.getTotal()).isGreaterThanOrEqualTo(2);

        // 列表出参在字段层面就不该有正文
        assertThat(ArticleCardVO.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .doesNotContain("contentMd", "status");
    }

    @Test
    void sizeIsClampedEvenWhenCallerAsksForHugePage() {
        ArticleQuery query = new ArticleQuery();
        query.setSize(9999);

        assertThat(articleService.listPublished(query).getSize()).isEqualTo(50);
    }

    @Test
    void detailCarriesMarkdownTagsAndOlderNeighbour() {
        ArticleDetailVO detail = articleService.getPublishedDetail(SINGLE);

        assertThat(detail.getContentMd()).contains("# 探针标题");
        assertThat(detail.getType()).isEqualTo("TECH");
        assertThat(detail.getCategoryName()).isNull();  // 探针没挂分类
        assertThat(detail.getTags()).extracting("slug").containsExactly(TAG_SLUG);
        assertThat(detail.getPrev()).isNotNull();
        assertThat(detail.getPrev().getSlug()).isEqualTo(OLDER);
        assertThat(detail.getNext()).isNull();          // 没有比它更新的探针
    }

    @Test
    void missingSlugIsReportedAsArticleNotFound() {
        assertThatThrownBy(() -> articleService.getPublishedDetail("no-such-slug-at-all"))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("code", ErrorCodeEnum.ARTICLE_NOT_FOUND.getCode());
    }

    @Test
    void draftIsNotReachableButViewCountStillGuardsExistence() {
        Long draftId = insertArticle("service-probe-draft", 0, null);
        try {
            assertThatThrownBy(() -> articleService.getPublishedDetail("service-probe-draft"))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("code", ErrorCodeEnum.ARTICLE_NOT_FOUND.getCode());
            assertThatThrownBy(() -> articleService.saveView("service-probe-draft", "127.0.0.1", "JUnit"))
                    .isInstanceOf(BusinessException.class);
        } finally {
            articleMapper.deleteById(draftId);
        }
    }
}
