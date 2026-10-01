package com.jcpress.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 公开详情的 VO。
 *
 * 字段与 {@link ArticleCardVO} 有意**重复声明**而不是继承：一是显式列出对外契约，
 * 二是与本项目「转换器逐字段写、不用反射拷贝」的纪律一致（继承会让"详情比卡片多了什么"
 * 变得不直观）。
 */
@Data
public class ArticleDetailVO {

    private Long id;
    private String title;
    private String slug;
    private String summary;
    private String coverUrl;
    private String categoryName;
    private String categorySlug;
    private List<TagVO> tags;
    private Integer readingMinutes;
    private Integer viewCount;
    private Integer top;
    private LocalDateTime publishTime;

    private String type;
    /** Markdown 原文（渲染管线在前端，后端不做渲染） */
    private String contentMd;
    /** 上一篇（更早）/ 下一篇（更晚）；不存在时为 null */
    private ArticleAdjacentVO prev;
    private ArticleAdjacentVO next;
}
