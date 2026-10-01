package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.query.ArticleQuery;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

/**
 * 内容主表 DAO。
 *
 * 分工（见 openspec design D-B）：
 * - 主键读写用继承来的 {@code selectById / insert / updateById / deleteById}；
 * - **任何带条件、联表、排序、分页的查询都写在本接口 + XML 里**，因为 Agent.md 禁止
 *   Service 层出现 QueryWrapper，而这类查询恰好是列表/详情/相邻篇的全部。
 */
public interface ArticleMapper extends BaseMapper<ArticleDO> {

    /** 公开列表：动态条件 + 分类联表；只取已发布 */
    Page<ArticleDO> listPublished(Page<ArticleDO> page, @Param("query") ArticleQuery query);

    /** 详情：按 slug 取已发布 */
    ArticleDO getPublishedBySlug(@Param("type") String type, @Param("slug") String slug);

    /** 按类型 + slug 取（**不带状态条件**，后台要看草稿） */
    ArticleDO getByTypeAndSlug(@Param("type") String type, @Param("slug") String slug);

    /** 相邻篇：同类型、已发布，按 publish_time 比大小各取 1 条 */
    ArticleDO getAdjacentNext(@Param("type") String type, @Param("publishTime") LocalDateTime publishTime);

    ArticleDO getAdjacentPrev(@Param("type") String type, @Param("publishTime") LocalDateTime publishTime);

    /** 浏览量回写：把 Redis 里攒的增量刷进 DB */
    int updateViewCountIncrement(@Param("id") Long id, @Param("delta") long delta);
}
