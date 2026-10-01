package com.jcpress.domain.converter;

import com.jcpress.domain.dataobject.AdminAuditLogDO;
import com.jcpress.domain.dataobject.AdminUserDO;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.vo.AdminUserVO;

/** 后台账号 / 审计的显式转换 */
public final class AdminConverter {

    private AdminConverter() {
    }

    public static AdminUserVO toAdminUserVO(AdminUserDO admin) {
        AdminUserVO vo = new AdminUserVO();
        vo.setId(admin.getId());
        vo.setUsername(admin.getUsername());
        vo.setNickname(admin.getNickname());
        vo.setRole(admin.getRole());
        return vo;
    }

    public static AdminAuditLogDO toAuditLogDO(AuditLogDTO dto) {
        AdminAuditLogDO log = new AdminAuditLogDO();
        log.setAdminId(dto.getAdminId());
        log.setAction(dto.getAction());
        log.setTargetType(dto.getTargetType());
        log.setTargetId(dto.getTargetId());
        log.setDetail(truncate(dto.getDetail(), 500));
        log.setIp(truncate(dto.getIp(), 64));
        log.setUserAgent(truncate(dto.getUserAgent(), 255));
        return log;
    }

    /** DB 列是 VARCHAR(255)/VARCHAR(500)，超长会直接抛 SQL 异常 —— 在这里先截断并说明原因 */
    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
