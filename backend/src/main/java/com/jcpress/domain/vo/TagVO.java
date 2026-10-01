package com.jcpress.domain.vo;

import lombok.Data;

@Data
public class TagVO {

    private Long id;
    private String name;
    private String slug;
    /**
     * 已发布计数（文章卡片里的标签不填，默认 0）。
     *
     * **用 `long` 而不是 `Long`**：Gson 只把包装类型 Long 转成字符串（那是为了 ID 防精度丢失），
     * 计数走数字。声明成包装类型会让它静默变成 "3"。
     */
    private int articleCount;
}
