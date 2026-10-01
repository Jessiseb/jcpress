package com.jcpress.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 后台新建/更新文章的入参。
 *
 * `slug` 可空：留空时若标题含拉丁字符会由 `SlugUtils` 生成，**纯中文标题不猜拼音**
 * （会返回参数错误要求手填）。
 */
@Data
public class ArticleSaveDTO {

    @NotBlank(message = "标题不能为空")
    @Size(max = 200, message = "标题过长")
    private String title;

    @Size(max = 120, message = "slug 过长")
    private String slug;

    @Size(max = 500, message = "摘要过长")
    private String summary;

    @Size(max = 255, message = "封面地址过长")
    private String coverUrl;

    @NotNull(message = "必须选择分类")
    private Long categoryId;

    /** 标签**名字**数组；服务端负责解析已有标签或创建新标签 */
    @Size(max = 6, message = "一篇文章最多 6 个标签")
    private List<String> tags;

    @NotBlank(message = "正文不能为空")
    private String contentMd;

    /** 0 草稿 1 已发布；不传按草稿处理 */
    private Integer status;
}
