package com.jcpress.common.constant;

/**
 * 审计动作名（与 `admin_audit_log.action` 的注释对齐）。
 *
 * 注意这些是**操作名**，不是 HTTP 方法 —— §9.1 里 `DELETE` 作为 HTTP 方法是禁用的，
 * 但作为"删除操作"的审计动作名是正常的。
 */
public final class AuditActionConstant {

    public static final String LOGIN = "LOGIN";
    public static final String LOGOUT = "LOGOUT";
    public static final String CREATE = "CREATE";
    public static final String UPDATE = "UPDATE";
    public static final String DELETE = "DELETE";
    public static final String PUBLISH = "PUBLISH";
    public static final String UPLOAD = "UPLOAD";

    private AuditActionConstant() {
    }
}
