package com.jcpress.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 注意两处与初稿计划不同的期望值 —— 都是按实现的实际语义重新算过的：
 *
 * 1. `normalize("Spring Boot 3 里替换 Jackson")` 得到 `spring-boot-3-jackson`，
 *    而不是 `spring-boot-3`：非字母数字的**连续段**整体压成一个短横线，
 *    中文段只贡献一个 `-`，后面的 `Jackson` 会保留。
 * 2. 纯中文标题返回 null（不猜拼音），由上层要求调用方手填。
 */
class SlugUtilsTest {

    @Test
    void normalizesLatinTitleToKebabCaseKeepingTrailingWords() {
        assertThat(SlugUtils.normalize("Spring Boot 3 里替换 Jackson"))
                .isEqualTo("spring-boot-3-jackson");
    }

    @Test
    void collapsesSeparatorsAndTrimsDashes() {
        assertThat(SlugUtils.normalize("  Redis   ZSet -- 分片  ")).isEqualTo("redis-zset");
    }

    @Test
    void stripsAccentsSoLatinTitlesStayAscii() {
        assertThat(SlugUtils.normalize("Café Déjà Vu")).isEqualTo("cafe-deja-vu");
    }

    @Test
    void returnsNullWhenNothingUsableRemains() {
        assertThat(SlugUtils.normalize("三期后端复盘")).isNull();
        assertThat(SlugUtils.normalize("")).isNull();
        assertThat(SlugUtils.normalize(null)).isNull();
    }

    @Test
    void validatesFormat() {
        assertThat(SlugUtils.isValid("phase-3-backend-retro")).isTrue();
        assertThat(SlugUtils.isValid("Phase-3")).isFalse();          // 大写不允许
        assertThat(SlugUtils.isValid("-leading")).isFalse();
        assertThat(SlugUtils.isValid("trailing-")).isFalse();
        assertThat(SlugUtils.isValid("has_underscore")).isFalse();
        assertThat(SlugUtils.isValid("double--dash")).isFalse();
        assertThat(SlugUtils.isValid("ab")).isFalse();               // 太短
        assertThat(SlugUtils.isValid(null)).isFalse();
    }

    @Test
    void truncatesLongSlugAtDashBoundary() {
        String longSlug = "a".repeat(80) + "-" + "b".repeat(80);

        String normalized = SlugUtils.normalize(longSlug);

        assertThat(normalized).hasSizeLessThanOrEqualTo(SlugUtils.MAX_LENGTH);
        assertThat(normalized).doesNotEndWith("-");
        assertThat(SlugUtils.isValid(normalized)).isTrue();
    }
}
