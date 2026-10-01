package com.jcpress.common.constant;

/**
 * 后台相关常量。集中在一处，避免魔法值散落（Agent.md 禁止魔法值）。
 */
public final class AdminConstant {

    public static final int STATUS_ENABLED = 1;
    public static final int STATUS_DISABLED = 0;

    /** 连续失败 5 次锁定 15 分钟（规划 §7 的 login:fail:{username}） */
    public static final int LOGIN_FAIL_LIMIT = 5;
    public static final long LOGIN_FAIL_WINDOW_SECONDS = 900L;

    /** 登录接口限流：同一 IP 每分钟 10 次 */
    public static final int LOGIN_RATE_LIMIT = 10;
    public static final long LOGIN_RATE_WINDOW_SECONDS = 60L;

    public static final String TARGET_TYPE_ARTICLE = "ARTICLE";
    public static final String TOKEN_NAME = "jcpress-token";

    /** 文章状态：0 草稿 1 已发布 2 归档 */
    public static final int ARTICLE_STATUS_DRAFT = 0;
    public static final int ARTICLE_STATUS_PUBLISHED = 1;
    public static final int ARTICLE_STATUS_ARCHIVED = 2;

    /** 一篇文章最多 6 个标签 */
    public static final int MAX_TAGS_PER_ARTICLE = 6;

    public static final String TYPE_TECH = "TECH";

    private AdminConstant() {
    }
}
