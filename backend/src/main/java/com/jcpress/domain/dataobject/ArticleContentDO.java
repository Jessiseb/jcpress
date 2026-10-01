package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 正文（与 article 主表 1:1）。
 *
 * 主键直接用 article_id，不额外造代理键 —— 1:1 扩展表用共享主键能天然保证一对一
 * （规划 §6.6 的有意偏离之一）。
 */
@Data
@TableName("article_content")
public class ArticleContentDO {

    @TableId(type = IdType.INPUT)
    private Long articleId;

    /** Markdown 原文；渲染在前端，后端不维护第二份真相 */
    private String contentMd;

    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;
}
