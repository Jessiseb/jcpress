package com.jcpress.common.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * slug 生成与校验。
 *
 * **不猜拼音**：把「三期后端复盘」转成 slug 需要拼音库，而本期没有批准新增这个依赖。
 * 所以 {@link #normalize(String)} 在全是不含拉丁字符的标题时返回 {@code null}，
 * 由上层（Service）报参数错误要求调用方手填 —— 猜出来的 slug 只会让人看不懂、
 * 而且一旦生成就进了 URL 与数据库唯一索引，改起来更贵。
 */
public final class SlugUtils {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 120;

    private static final Pattern VALID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    /** 连续的非字母数字压成一个短横线 */
    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private SlugUtils() {
    }

    /**
     * 拉丁字母/数字 → kebab-case。
     *
     * 中文会被压成一个短横线而不是被丢掉，所以「Spring Boot 3 里替换 Jackson」
     * 得到的是 {@code spring-boot-3-jackson}（保留了末尾那个英文词）。
     *
     * @return 规范化后的 slug；若不含足够拉丁字符（例如纯中文标题）返回 {@code null}
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String ascii = Normalizer.normalize(raw, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = NON_SLUG.matcher(ascii.toLowerCase()).replaceAll("-");
        slug = slug.replaceAll("(^-+)|(-+$)", "");
        return slug.length() < MIN_LENGTH ? null : truncate(slug);
    }

    public static boolean isValid(String slug) {
        return slug != null
                && slug.length() >= MIN_LENGTH
                && slug.length() <= MAX_LENGTH
                && VALID.matcher(slug).matches();
    }

    /** 超长时在最后一个短横线处截断，避免把单词切成两半 */
    private static String truncate(String slug) {
        if (slug.length() <= MAX_LENGTH) {
            return slug;
        }
        String cut = slug.substring(0, MAX_LENGTH);
        int lastDash = cut.lastIndexOf('-');
        return lastDash > MIN_LENGTH ? cut.substring(0, lastDash) : cut;
    }
}
