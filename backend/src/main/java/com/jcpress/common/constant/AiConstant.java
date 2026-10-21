package com.jcpress.common.constant;

/**
 * AI 排版（后台写入口的辅助能力）相关常量。
 *
 * 能力定位：**只做排版整理与元信息抽取**，不做内容创作。所以这里的上限值全部沿用
 * `ArticleSaveDTO` 的校验边界 —— 模型吐回来的东西如果超出，前端就不写入表单，
 * 免得"AI 生成的摘要"反过来把保存接口校验卡住。
 */
public final class AiConstant {

    /** 接口限流：同一 IP 每分钟 10 次（与登录同档；AI 调用比写接口贵得多，不能再宽） */
    public static final int RATE_LIMIT = 10;
    public static final long RATE_WINDOW_SECONDS = 60L;

    /** 限流键里的路由名，对应 RedisKeyConstant.RATE_LIMIT 的第二个占位符 */
    public static final String ROUTE = "ai-format";

    /**
     * 正文长度上限（字符）。超了直接拒，不截断 —— 截断会让模型基于半截文章排版，
     * 产出看着正常实则丢内容，那种错误比报错难查得多。
     */
    public static final int MAX_INPUT_CHARS = 20000;

    /** 元信息上限，与 ArticleSaveDTO 的 @Size 对齐 */
    public static final int MAX_SUMMARY_CHARS = 500;
    public static final int MAX_SLUG_CHARS = 120;
    public static final int MAX_TITLE_CHARS = 200;

    /** 标签个数上限，与 AdminConstant.MAX_TAGS_PER_ARTICLE 同源 */
    public static final int MAX_TAGS = AdminConstant.MAX_TAGS_PER_ARTICLE;

    /** slug 规则（与后端 SlugUtils、前端 SLUG_PATTERN 一致） */
    public static final String SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    /** 审计动作 */
    public static final String AUDIT_DETAIL_FORMAT = "AI 排版：输入 %d 字，输出 %d 字";

    private AiConstant() {
    }
}
