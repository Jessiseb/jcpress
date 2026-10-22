package com.jcpress.domain.vo;

import lombok.Data;

/** 文章排行的一条：期间阅读数 + 累计阅读数 + 能否点进编辑页 */
@Data
public class ArticleStatsVO {

    private Long id;
    private String title;
    private String slug;
    /** 期间内阅读数（按天去重口径） */
    private Integer periodView;
    /** 累计阅读数，即 article.view_count */
    private Integer totalView;
}
