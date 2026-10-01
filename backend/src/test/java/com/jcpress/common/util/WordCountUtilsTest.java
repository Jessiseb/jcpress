package com.jcpress.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 同样修正了初稿计划里的一处期望值：「把 Redis ZSet 分片写清楚」按"汉字个数 + 拉丁词个数"
 * 的口径是 **8**（6 个汉字 + Redis + ZSet），不是 11。
 */
class WordCountUtilsTest {

    @Test
    void countsCjkCharactersPlusLatinWords() {
        assertThat(WordCountUtils.count("把 Redis ZSet 分片写清楚")).isEqualTo(8);
    }

    @Test
    void markdownSyntaxIsNotCounted() {
        String markdown = """
                # 标题

                ![图](/uploads/a.png)

                ```java
                public class Demo {}
                ```

                正文两字
                """;
        // 只数可见正文：标题 2 + 正文 4 = 6（围栏代码块、图片、URL 都不算）
        assertThat(WordCountUtils.count(markdown)).isEqualTo(6);
    }

    @Test
    void linkTextIsCountedButUrlIsNot() {
        assertThat(WordCountUtils.count("见 [sa-token](https://sa-token.cc) 文档")).isEqualTo(4);
    }

    @Test
    void blankOrNullIsZero() {
        assertThat(WordCountUtils.count(null)).isZero();
        assertThat(WordCountUtils.count("   ")).isZero();
    }

    @Test
    void readingMinutesFollowFourHundredPerMinuteWithFloorOfOne() {
        assertThat(WordCountUtils.estimateReadingMinutes(0)).isEqualTo(1);
        assertThat(WordCountUtils.estimateReadingMinutes(1)).isEqualTo(1);
        assertThat(WordCountUtils.estimateReadingMinutes(400)).isEqualTo(1);
        assertThat(WordCountUtils.estimateReadingMinutes(401)).isEqualTo(2);
        assertThat(WordCountUtils.estimateReadingMinutes(3167)).isEqualTo(8);
    }
}
