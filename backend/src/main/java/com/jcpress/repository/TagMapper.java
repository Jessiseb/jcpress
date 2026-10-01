package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.TagDO;
import com.jcpress.domain.projection.TagWithCountRef;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TagMapper extends BaseMapper<TagDO> {

    /** 标签列表 + 已发布计数 */
    List<TagWithCountRef> listWithPublishedCount();

    /** 按 slug 取（后台保存文章时"解析或创建"标签要用） */
    TagDO getBySlug(@Param("slug") String slug);
}
