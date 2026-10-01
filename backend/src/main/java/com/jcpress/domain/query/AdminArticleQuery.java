package com.jcpress.domain.query;

import lombok.Getter;
import lombok.Setter;

/**
 * 后台列表筛选（**含草稿**，与公开列表的关键差别）。
 *
 * 同 {@code ArticleQuery}：只取 `@Getter @Setter`，避免为消 Lombok 告警而动用到
 * Agent.md 白名单之外的注解。
 */
@Getter
@Setter
public class AdminArticleQuery extends PageQuery {

    private String type = "TECH";

    /** null = 全部状态 */
    private Integer status;
    private Long categoryId;

    /**
     * 关键词。主路径走 ngram 全文索引（`AGAINST('kw*' IN BOOLEAN MODE)`），
     * 长度不足 2 个字符时回退标题前缀匹配 —— `ngram_token_size=2`，单字在全文索引里命中 0。
     */
    private String keyword;
}
