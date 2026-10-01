package com.jcpress.domain.vo;

import lombok.Data;

@Data
public class TagVO {

    private Long id;
    private String name;
    private String slug;
    /** 列表接口会带上已发布计数；文章卡片里的标签不填 */
    private Long articleCount;
}
