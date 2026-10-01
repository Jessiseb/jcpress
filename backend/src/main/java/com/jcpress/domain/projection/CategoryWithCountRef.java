package com.jcpress.domain.projection;

import lombok.Data;

/** 分类 + 已发布计数的行投影（Mapper 只回投影，不回 VO） */
@Data
public class CategoryWithCountRef {

    private Long id;
    private String name;
    private String slug;
    private String description;
    private Long articleCount;
}
