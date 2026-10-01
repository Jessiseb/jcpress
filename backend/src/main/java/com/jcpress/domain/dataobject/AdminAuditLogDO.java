package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 后台操作审计（**只追加**表）。
 *
 * 按《Java开发手册》建表规约，只追加表不设 `gmt_modified` —— 这是规划 §6.6 里
 * 三处有意偏离之一，已在文档里说明。
 */
@Data
@TableName("admin_audit_log")
public class AdminAuditLogDO {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long adminId;
    private String action;
    private String targetType;
    private Long targetId;
    private String detail;
    private String ip;
    private String userAgent;
    private LocalDateTime gmtCreate;
}
