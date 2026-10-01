package com.jcpress.domain.dto;

import lombok.Data;

/** 审计日志的入参（由 Service 组装后落库） */
@Data
public class AuditLogDTO {

    private Long adminId;
    private String action;
    private String targetType;
    private Long targetId;
    private String detail;
    private String ip;
    private String userAgent;
}
