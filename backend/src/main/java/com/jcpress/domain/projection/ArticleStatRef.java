package com.jcpress.domain.projection;

import lombok.Data;

/**
 * 文章排行的行投影。
 *
 * {@code title} 可能为 null —— 文章被删掉后日聚合记录仍会留到期（见 spec
 * 「文章已删除也不报错」）。用 LEFT JOIN 取，不要 INNER JOIN 把它们整行丢掉。
 */
@Data
public class ArticleStatRef {

    private Long articleId;
    private String title;
    private String slug;
    private Integer periodView;
    private Integer totalView;
}
