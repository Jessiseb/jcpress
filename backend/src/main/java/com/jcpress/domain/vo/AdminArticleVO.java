package com.jcpress.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 后台文章出参：**含 status 与 gmtModified**（公开出参里没有这些），
 * 标签下发**名字**数组（编辑器直接可用）。
 *
 * 与公开 VO 各写各的、不复用：字段集不同，复用迟早会把草稿状态或内部字段漏到公开接口。
 */
@Data
public class AdminArticleVO {

    private Long id;
    private String title;
    private String slug;
    private String summary;
    private String coverUrl;
    private Long categoryId;
    private String categoryName;
    private List<String> tags;
    private Integer status;
    private Integer wordCount;
    private Integer readingMinutes;
    private Integer viewCount;
    private Integer top;
    private LocalDateTime publishTime;
    private LocalDateTime gmtModified;

    /** **只有详情接口会填**；列表里恒为 null（列表一次拉 20 篇正文没必要） */
    private String contentMd;
}
