package com.jcpress.service;

import com.jcpress.domain.dto.AuditLogDTO;

/**
 * 审计日志。
 *
 * 命名说明：`saveLog` 而不是 `log(...)` —— `log` 是动词但不是 Agent.md 的 CRUD 前缀之一，
 * 而这里的语义确实是"插入一条记录"，用 save 既合规又准确。
 */
public interface AuditLogService {

    void saveLog(AuditLogDTO auditLogDTO);
}
