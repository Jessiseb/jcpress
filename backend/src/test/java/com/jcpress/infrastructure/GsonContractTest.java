package com.jcpress.infrastructure;

import com.google.gson.Gson;
import com.jcpress.infrastructure.config.GsonConfig;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Gson 取代 Jackson 后的三条契约（规划 §5.4 列的坑，逐条钉住）。
 */
class GsonContractTest {

    static class Payload {
        Long id = 1900000000000000001L;
        LocalDateTime publishedAt = LocalDateTime.of(2026, 8, 12, 9, 30, 0);
        LocalDate day = LocalDate.of(2026, 8, 12);
        String missing = null;
    }

    /**
     * 计数字段必须用 `int`；这里同时钉住那个**陷阱**：`long` 基本类型也会被字符串化。
     *
     * Gson 对 `Long.class` 注册的适配器**同样作用于基本类型 `long`**（实测，与"包装类型才受影响"的
     * 直觉相反）。所以本项目定死一条能落地的规则：**`Long` 一律是 ID、一律字符串；计数与度量用 `int`**。
     * 这条测试的存在意义就是：以后有人把 `total` 改回 `long`，会立刻红。
     */
    static class Counters {
        int total = 3;
        int articleCount = 0;
        Long id = 2L;
        long primitiveLong = 5L;
    }

    private final Gson gson = GsonConfig.buildGson();

    @Test
    void longIsSerializedAsStringToAvoidJsPrecisionLoss() {
        assertThat(gson.toJson(new Payload())).contains("\"id\":\"1900000000000000001\"");
    }

    @Test
    void countersMustBeIntBecausePrimitiveLongIsStringifiedToo() {
        String json = gson.toJson(new Counters());

        assertThat(json).contains("\"total\":3");
        assertThat(json).contains("\"articleCount\":0");
        assertThat(json).contains("\"id\":\"2\"");
        // 基本类型 long 也会变成字符串 —— 这正是计数不能用 long 的原因
        assertThat(json).contains("\"primitiveLong\":\"5\"");
        assertThat(json).doesNotContain("\"total\":\"3\"");
    }

    @Test
    void javaTimeUsesProjectFormat() {
        String json = gson.toJson(new Payload());
        assertThat(json).contains("\"publishedAt\":\"2026-08-12 09:30:00\"");
        assertThat(json).contains("\"day\":\"2026-08-12\"");
    }

    @Test
    void nullFieldsAreEmittedSoFrontendTypesStayStable() {
        assertThat(gson.toJson(new Payload())).contains("\"missing\":null");
    }
}
