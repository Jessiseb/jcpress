package com.jcpress.domain.vo;

import lombok.Data;

@Data
public class UploadFileVO {

    /** 对外可访问的完整 URL（含 context-path），可直接写进 Markdown */
    private String url;
    private Long size;
}
