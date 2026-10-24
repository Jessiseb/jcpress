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

    /**
     * 站点统计的日内累计（hash，一个自然日一个 key）：stat:day:{yyyyMMdd}
     *
     * 字段约定：
     * · {@link #STAT_FIELD_PV} / {@link #STAT_FIELD_UV} —— 当天总 PV / UV；
     * · {@code p:} + path —— 该路径当天 PV；
     * · {@code a:} + articleId —— 该文章当天阅读数。
     *
     * 一个 key 装全部，是为了回写时**只扫一个模式**（`stat:day:*`）。分开存会让
     * 定时任务要扫 3 个 pattern，还得处理其中一半存在、一半不存在的中间态。
     */
    public static final String STAT_DAY = "stat:day:%s";

    /** 站点日 UV 去重集合：stat:uv:{yyyyMMdd}，成员是访客指纹 */
    public static final String STAT_UV = "stat:uv:%s";

    public static final String STAT_FIELD_PV = "pv";
    public static final String STAT_FIELD_UV = "uv";

    /** 路径字段前缀（path 一定以 / 开头，不会与 pv/uv/a: 冲突） */
    public static final String STAT_PATH_PREFIX = "p:";

    /** 文章字段前缀 */
    public static final String STAT_ARTICLE_PREFIX = "a:";

    /**
     * 小时字段前缀：`h:` + 小时（0–23）—— 与日总量共用同一个 hash。
     *
     * 为什么小时维度只记 PV：小时 UV 是「这一小时里的独立访客」，24 个小时相加
     * 会把人算 24 次。真要问「几点有人来」，看的是次数分布（见 V4 迁移的注释）。
     */
    public static final String STAT_HOUR_PREFIX = "h:";

    /** 回写时扫描的模式 */
    public static final String STAT_DAY_PATTERN = "stat:day:*";

    /**
     * 统计键的 TTL：7 天。
     *
     * 比回写间隔（5 分钟）长得多，是为了让「定时任务停了几小时 / 进程重启」这类空窗
     * 在恢复后仍能补齐；同时保证 Redis 里不会长期留着哪天的累计值。
     */
    public static final long STAT_TTL_DAYS = 7L;

    /** 采集接口的限流：每个 IP 每分钟最多记多少次（正常访问远低于此） */
    public static final int PAGEVIEW_RATE_LIMIT_PER_MINUTE = 120;

    /** 接口限流：rate:{ip}:{route} */
    public static final String RATE_LIMIT = "rate:%s:%s";

    private RedisKeyConstant() {
    }
}
