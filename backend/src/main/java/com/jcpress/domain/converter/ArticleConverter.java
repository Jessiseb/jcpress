package com.jcpress.domain.converter;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.vo.ArticleAdjacentVO;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.domain.vo.TagVO;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * DO/投影 → VO 的**显式**转换。
 *
 * 为什么不用 BeanUtils 之类的反射拷贝：字段名一变就静默丢数据，而且会把 status 这类
 * 内部字段顺手带出去。规划 §11.4 把 converter 单独列一层就是为了这件事。
 */
public final class ArticleConverter {

    private ArticleConverter() {
    }

    public static ArticleCardVO toCardVO(ArticleDO article) {
        ArticleCardVO vo = new ArticleCardVO();
        vo.setId(article.getId());
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setSummary(article.getSummary());
        vo.setCoverUrl(article.getCoverUrl());
        vo.setCategoryName(article.getCategoryName());
        vo.setCategorySlug(article.getCategorySlug());
        vo.setReadingMinutes(article.getReadingMinutes());
        vo.setViewCount(article.getViewCount());
        vo.setTop(article.getTop());
        vo.setPublishTime(article.getPublishTime());
        vo.setTags(List.of());
        return vo;
    }

    public static TagVO toTagVO(ArticleTagRef ref) {
        TagVO vo = new TagVO();
        vo.setName(ref.getName());
        vo.setSlug(ref.getSlug());
        return vo;
    }

    /** 把「按 articleId 取回的一批标签投影」按文章分组 —— 一次批量查询替代 N+1 */
    public static Map<Long, List<TagVO>> groupTags(List<ArticleTagRef> refs) {
        return refs.stream().collect(Collectors.groupingBy(
                ArticleTagRef::getArticleId,
                Collectors.mapping(ArticleConverter::toTagVO, Collectors.toList())));
    }

    public static List<TagVO> filterTagsOf(List<ArticleTagRef> refs, Long articleId) {
        return refs.stream()
                .filter(ref -> ref.getArticleId().equals(articleId))
                .map(ArticleConverter::toTagVO)
                .toList();
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

    public static ArticleDetailVO toDetailVO(ArticleDO article, ArticleContentDO content,
                                             List<TagVO> tags, ArticleDO prev, ArticleDO next) {
        ArticleDetailVO vo = new ArticleDetailVO();
        vo.setId(article.getId());
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setSummary(article.getSummary());
        vo.setCoverUrl(article.getCoverUrl());
        vo.setCategoryName(article.getCategoryName());
        vo.setCategorySlug(article.getCategorySlug());
        vo.setTags(tags);
        vo.setReadingMinutes(article.getReadingMinutes());
        vo.setViewCount(article.getViewCount());
        vo.setTop(article.getTop());
        vo.setPublishTime(article.getPublishTime());
        vo.setType(article.getType());
        vo.setContentMd(content == null ? "" : content.getContentMd());
        vo.setPrev(toAdjacentVO(prev));
        vo.setNext(toAdjacentVO(next));
        return vo;
    }
}
