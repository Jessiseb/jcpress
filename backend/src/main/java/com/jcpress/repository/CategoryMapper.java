package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.CategoryDO;
import com.jcpress.domain.projection.CategoryWithCountRef;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface CategoryMapper extends BaseMapper<CategoryDO> {

    /** 分类列表 + 已发布计数（没有文章的分类也要出现，计数为 0） */
    List<CategoryWithCountRef> listWithPublishedCount(@Param("scope") String scope);

    /** 按 scope + slug 取（导入器用它把 front-matter 的 category 解析成 category_id） */
    CategoryDO getByScopeAndSlug(@Param("scope") String scope, @Param("slug") String slug);
}
