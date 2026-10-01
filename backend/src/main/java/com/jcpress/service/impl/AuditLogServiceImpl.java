package com.jcpress.service.impl;

import com.jcpress.domain.converter.AdminConverter;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.repository.AdminAuditLogMapper;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AdminAuditLogMapper adminAuditLogMapper;

    @Override
    public void saveLog(AuditLogDTO auditLogDTO) {
        // 不额外开事务：调用方（写操作的 Service）本身在事务里，审计与业务同生共死
        adminAuditLogMapper.insert(AdminConverter.toAuditLogDO(auditLogDTO));
    }
}
