package com.jcpress.domain.converter;

import com.jcpress.domain.projection.CategoryWithCountRef;
import com.jcpress.domain.projection.TagWithCountRef;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.domain.vo.TagVO;

import java.util.List;

/** 分类 / 标签投影 → VO（同样显式逐字段） */
public final class TaxonomyConverter {

    private TaxonomyConverter() {
    }

    public static CategoryVO toCategoryVO(CategoryWithCountRef ref) {
        CategoryVO vo = new CategoryVO();
        vo.setId(ref.getId());
        vo.setName(ref.getName());
        vo.setSlug(ref.getSlug());
        vo.setDescription(ref.getDescription());
        vo.setArticleCount(ref.getArticleCount() == null ? 0 : ref.getArticleCount().intValue());
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
        vo.setArticleCount(ref.getArticleCount() == null ? 0 : ref.getArticleCount().intValue());
        return vo;
    }

    public static List<TagVO> toTagVOs(List<TagWithCountRef> refs) {
        return refs.stream().map(TaxonomyConverter::toTagVO).toList();
    }
}
