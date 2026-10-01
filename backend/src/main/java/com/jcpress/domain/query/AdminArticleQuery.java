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

    /**
     * 全文检索表达式（`kw*`）；关键词不足 2 字符时为 null，让 SQL 走回退分支。
     *
     * **为什么在 Java 侧拼好而不是在 SQL 里 `CONCAT(#{keyword}, '*')`**：
     * MyBatis-Plus 的分页插件会用 JSqlParser 解析 SQL 来生成 count 语句，
     * 而它解析不了 `AGAINST(CONCAT(...))` —— 实测直接抛
     * `ParseException: Encountered unexpected token: "CONCAT"`。
     * 顺带的好处：这个"长度 ≥ 2 才走全文索引"的规则变成了可单测的纯逻辑。
     */
    public String getFullTextExpression() {
        return keyword == null || keyword.length() < 2 ? null : keyword + "*";
    }

    /** 前缀匹配表达式（`kw%`，只用于单字回退） */
    public String getPrefixExpression() {
        return keyword == null || keyword.isEmpty() ? null : keyword + "%";
    }
}
