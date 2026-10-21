package com.jcpress.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** AI 排版的入参 */
@Data
public class AiFormatDTO {

    @NotBlank(message = "正文不能为空")
    private String contentMd;

    /** 标题：给模型判断语境用，可空。**不参与**排版结果，只进 prompt */
    private String title;
}
