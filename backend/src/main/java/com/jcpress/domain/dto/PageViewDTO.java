package com.jcpress.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 一次页面访问的上报体。只有 path —— 不报 referrer、不报任何标识（design D-I）。 */
@Data
public class PageViewDTO {

    /** 规范化后的 pathname；长度上限与 visit_path_daily.path 的列宽一致 */
    @NotBlank(message = "路径不能为空")
    @Size(max = 160, message = "路径过长")
    private String path;
}
