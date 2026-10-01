package com.jcpress.common.constant;

/**
 * Redis 键模式集中管理（规划 §7）。禁止在业务代码里散写键名。
 *
 * 注意：Sa-Token 自己的会话键前缀来自 {@code sa-token.token-name}（jcpress-token），
 * 不在这里 —— 那些键由框架维护，业务代码不要手写也不要清理。
 */
public final class RedisKeyConstant {

    /** 浏览量去重集合：view:article:{articleId}:{yyyyMMdd}，成员是访客指纹 */
    public static final String VIEW_DEDUPE = "view:article:%d:%s";

    /** 待回写的浏览量增量：view:count:{articleId} */
    public static final String VIEW_PENDING = "view:count:%d";

    /** 待回写键在刷新期间的临时名（RENAME 的目标） */
    public static final String VIEW_PENDING_FLUSHING_SUFFIX = ":flushing";

    /** 去重集合的 TTL：2 天（规划 §7） */
    public static final long VIEW_DEDUPE_TTL_DAYS = 2L;

    /** 扫描待回写键的模式 */
    public static final String VIEW_PENDING_PATTERN = "view:count:*";

    /** 后台登录失败计数：login:fail:{username} */
    public static final String LOGIN_FAIL = "login:fail:%s";

    /** 接口限流：rate:{ip}:{route} */
    public static final String RATE_LIMIT = "rate:%s:%s";

    private RedisKeyConstant() {
    }
}
