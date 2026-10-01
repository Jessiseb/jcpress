package com.jcpress.domain.projection;

import lombok.Data;

/**
 * {@code article_tag JOIN tag} 的行投影。
 *
 * 存在的意义：列表页要显示每篇文章的标签，逐篇查就是 N+1；用一次
 * {@code WHERE article_id IN (...)} 取回后在内存里分组（见 {@code ArticleConverter.groupTags}）。
 *
 * 投影放 {@code domain.projection} 而不是 {@code domain.vo}：它们不是对外契约，
 * 只是 Mapper 的行载体 —— repository 只碰 DO 与投影，VO 由 converter 造。
 */
@Data
public class ArticleTagRef {

    private Long articleId;
    private String name;
    private String slug;
}
