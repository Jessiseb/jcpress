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

    private final Gson gson = GsonConfig.buildGson();

    @Test
    void longIsSerializedAsStringToAvoidJsPrecisionLoss() {
        assertThat(gson.toJson(new Payload())).contains("\"id\":\"1900000000000000001\"");
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
