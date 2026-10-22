package com.jcpress.domain.projection;

import lombok.Data;

/** 内容总量（总数 / 已发布数），用于看板底部的一行上下文 */
@Data
public class ArticleCountRef {

    private Integer total;
    private Integer published;
}
