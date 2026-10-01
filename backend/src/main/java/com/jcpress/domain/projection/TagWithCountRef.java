package com.jcpress.domain.projection;

import lombok.Data;

/** 标签 + 已发布计数的行投影 */
@Data
public class TagWithCountRef {

    private Long id;
    private String name;
    private String slug;
    private Long articleCount;
}
