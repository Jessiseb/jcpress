package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 内容主表映射（技术文章 / 算法笔记 / 项目笔记共用，用 type 区分）。
 *
 * 注意 {@code top} 字段：DB 列名是 {@code is_top}，而 Agent.md 要求 POJO 的布尔语义字段
 * **不加 is 前缀**，所以用 {@code @TableField} 显式映射。
 */
@Data
@TableName("article")
public class ArticleDO {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** TECH / ALGO / PROJECT（LIFE 预留） */
    private String type;
    private Long categoryId;
    private Long projectId;
    private String title;
    private String slug;
    private String summary;
    private String coverUrl;

    /** 0 草稿 1 已发布 2 归档 */
    private Integer status;
    private Integer wordCount;
    private Integer readingMinutes;
    private Integer viewCount;
    private Integer likeCount;

    @TableField("is_top")
    private Integer top;

    private LocalDateTime publishTime;
    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;

    /** 来自 Mapper XML 里的 LEFT JOIN category，不是 article 表的列 */
    @TableField(exist = false)
    private String categoryName;

    @TableField(exist = false)
    private String categorySlug;
}
