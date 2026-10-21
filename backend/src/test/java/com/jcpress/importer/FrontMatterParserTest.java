package com.jcpress.importer;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * front-matter 解析的纯单元测试（不启 Spring、不连库）。
 *
 * 守的是 2026-10-20 真踩到的一个坑：`publishTime: 2026-10-20 19:30:00` 不加引号时，
 * SnakeYAML 会把它隐式当成时间戳解析成 `Date`（按 YAML 规范视为 UTC），
 * 直接 `String.valueOf` 得到 "Wed Oct 21 03:30:00 CST 2026"，
 * 导入时被格式校验拦下，且报错信息看不出真实原因。
 */
class FrontMatterParserTest {

    private final FrontMatterParser parser = new FrontMatterParser();

    private static final String TEMPLATE = """
            ---
            title: 线程笔记
            slug: importer-time-probe
            type: TECH
            category: java-backend
            tags: [Java, 并发]
            summary: 测时间戳解析
            status: PUBLISHED
            publishTime: %s
            ---
            # 正文
            """;

    @Test
    void unquotedPublishTimeKeepsItsLiteralValue() {
        var parsed = parser.parse(TEMPLATE.formatted("2026-10-20 19:30:00"), "probe.md");

        // 必须原样还原作者写的字面量：既不能变成 Date.toString，
        // 也不能因为「本地时区 +8」被推成次日 03:30
        assertThat(parsed.frontMatter().getPublishTime()).isEqualTo("2026-10-20 19:30:00");
    }

    @Test
    void quotedPublishTimeStaysAsIs() {
        var parsed = parser.parse(TEMPLATE.formatted("\"2026-10-20 19:30:00\""), "probe.md");

        assertThat(parsed.frontMatter().getPublishTime()).isEqualTo("2026-10-20 19:30:00");
    }
}
