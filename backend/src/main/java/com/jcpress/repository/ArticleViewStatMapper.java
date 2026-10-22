package com.jcpress.repository;

import com.jcpress.domain.projection.ArticleStatRef;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 文章阅读日聚合 DAO。
 *
 * 与 {@link ArticleMapper#updateViewCountIncrement} 的关系：那张表记「累计」，这张表记「哪天」。
 * 两边的写入都发生在 `ArticleViewManager` 判定「同指纹同日首次阅读」为真的那一刻，
 * 所以两张表的数字始终同源（design D-D）。
 */
public interface ArticleViewStatMapper {

    void saveArticleDay(@Param("articleId") Long articleId,
                   @Param("statDate") LocalDate statDate,
                   @Param("viewCount") int viewCount);

    /**
     * 期间排行。LEFT JOIN 是必须的：文章删掉后日表记录还在，
     * INNER JOIN 会让这些行整条消失（而它们恰恰是「这篇曾有人读」的证据）。
     */
    List<ArticleStatRef> listArticleTop(@Param("from") LocalDate from,
                                        @Param("to") LocalDate to,
                                        @Param("limit") int limit);
}
