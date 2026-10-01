package com.jcpress.domain.query;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 公开列表入参。
 *
 * **故意不含 keyword**：公开列表本期不做搜索（见 openspec design / proposal）。
 * 后台列表的筛选另有 AdminArticleQuery。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class ArticleQuery extends PageQuery {

    private String type = "TECH";
    private Long categoryId;
    private String tagSlug;
}
