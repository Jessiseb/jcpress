package com.jcpress.domain.vo;

import lombok.Data;

@Data
public class CategoryVO {

    private Long id;
    private String name;
    private String slug;
    private String description;
    /** 已发布计数；用 `int` 而不是 `Long`，理由见 TagVO.articleCount */
    private int articleCount;
}
