package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.ArticleTagDO;
import com.jcpress.domain.projection.ArticleTagRef;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ArticleTagMapper extends BaseMapper<ArticleTagDO> {

    /**
     * 一次批量取回多篇文章的标签（避免列表页 N+1）。
     *
     * 调用方必须**先挡掉空集合**：{@code IN ()} 是语法错误。
     */
    List<ArticleTagRef> listTagRefsByArticleIds(@Param("articleIds") List<Long> articleIds);

    /** 重建标签关系前先清空该文章的旧关系 */
    int deleteByArticleId(@Param("articleId") Long articleId);
}
