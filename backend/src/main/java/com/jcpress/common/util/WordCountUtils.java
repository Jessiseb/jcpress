package com.jcpress.common.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 字数统计与阅读时长估算。
 *
 * 口径：**先剥掉 Markdown 语法**（围栏代码块、图片、链接地址、HTML 标签、行首结构符号），
 * 再数「汉字个数 + 拉丁词个数」。这样得到的数接近"人眼读到的字数"，
 * 而不是"文件字节数"。
 *
 * 阅读时长按 {@link #CHARS_PER_MINUTE} 估算，向上取整、最小 1 分钟。
 */
public final class WordCountUtils {

    /** 中文阅读速度按 400 字/分钟估算（写进设计 D3） */
    public static final int CHARS_PER_MINUTE = 400;

    private static final Pattern CODE_FENCE = Pattern.compile("(?s)```.*?```");
    private static final Pattern IMAGE = Pattern.compile("!\\[[^]]*]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^]]*)]\\([^)]*\\)");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final Pattern STRUCTURE = Pattern.compile("(?m)^\\s{0,3}(#{1,6}|[-*+]|\\d+\\.|>|\\|)");
    private static final Pattern CJK = Pattern.compile("[\\u4e00-\\u9fff\\u3400-\\u4dbf]");
    private static final Pattern LATIN_WORD = Pattern.compile("[A-Za-z][A-Za-z0-9'-]*");

    private WordCountUtils() {
    }

    public static int count(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return 0;
        }
        String text = CODE_FENCE.matcher(markdown).replaceAll(" ");
        text = IMAGE.matcher(text).replaceAll(" ");
        text = LINK.matcher(text).replaceAll("$1");
        text = HTML_TAG.matcher(text).replaceAll(" ");
        text = STRUCTURE.matcher(text).replaceAll("");

        int total = 0;
        Matcher cjk = CJK.matcher(text);
        while (cjk.find()) {
            total++;
        }
        Matcher latin = LATIN_WORD.matcher(text);
        while (latin.find()) {
            total++;
        }
        return total;
    }

    public static int estimateReadingMinutes(int wordCount) {
        if (wordCount <= 0) {
            return 1;
        }
        return Math.max(1, (int) Math.ceil((double) wordCount / CHARS_PER_MINUTE));
    }
}
