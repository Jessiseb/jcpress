package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.AdminAuditLogDO;

/**
 * 审计日志 DAO：只写不读（读审计是排障时手工查库的事，不做接口）。
 * 只需要继承的 insert。
 */
public interface AdminAuditLogMapper extends BaseMapper<AdminAuditLogDO> {
}
