package com.jcpress.domain.converter;

import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
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
        article.setType("TECH");
        article.setTitle("ThreadLocal 在 Tool 层的上下文隔离");
        article.setSlug("threadlocal-tool-context");
        article.setSummary("并发串扰排查");
        article.setStatus(1);
        article.setWordCount(3200);
        article.setReadingMinutes(9);
        article.setViewCount(12);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.of(2026, 8, 12, 9, 0, 0));
        article.setCategoryName("AI · Agent");
        article.setCategorySlug("ai-agent");
        return article;
    }

    @Test
    void cardVoCarriesCategoryAndTagsButNoInternalFields() {
        ArticleCardVO vo = ArticleConverter.toCardVO(sampleArticle());

        assertThat(vo.getId()).isEqualTo(1L);
        assertThat(vo.getCategoryName()).isEqualTo("AI · Agent");
        assertThat(vo.getReadingMinutes()).isEqualTo(9);
        assertThat(vo.getTags()).isEmpty();

        // 公开出参绝不能带这些字段 —— 直接从类的字段声明上兜住（编译期就保证）
        assertThat(ArticleCardVO.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .doesNotContain("status", "gmtModified", "contentMd", "wordCount");
    }

    @Test
    void detailVoCarriesMarkdownAndAdjacentButNotStatus() {
        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(1L);
        content.setContentMd("# 标题\n\n正文");

        ArticleDetailVO vo = ArticleConverter.toDetailVO(sampleArticle(), content,
                List.of(), null, null);

        assertThat(vo.getContentMd()).contains("# 标题");
        assertThat(vo.getType()).isEqualTo("TECH");
        assertThat(vo.getPrev()).isNull();
        assertThat(vo.getNext()).isNull();
        assertThat(ArticleDetailVO.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .doesNotContain("status", "wordCount");
    }

    @Test
    void missingContentBecomesEmptyStringNotNull() {
        ArticleDetailVO vo = ArticleConverter.toDetailVO(sampleArticle(), null, List.of(), null, null);

        assertThat(vo.getContentMd()).isEmpty();
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
        ArticleTagRef third = new ArticleTagRef();
        third.setArticleId(1L);
        third.setName("MySQL");
        third.setSlug("mysql");

        Map<Long, List<TagVO>> grouped = ArticleConverter.groupTags(List.of(first, second, third));

        assertThat(grouped.get(1L)).extracting(TagVO::getSlug).containsExactly("redis", "mysql");
        assertThat(grouped.get(2L)).extracting(TagVO::getSlug).containsExactly("concurrency");
    }

    @Test
    void adjacentVoIsNullWhenArticleIsNullSoFrontendCanHideTheCard() {
        assertThat(ArticleConverter.toAdjacentVO(null)).isNull();
        assertThat(ArticleConverter.toAdjacentVO(sampleArticle()).getSlug())
                .isEqualTo("threadlocal-tool-context");
    }
}
