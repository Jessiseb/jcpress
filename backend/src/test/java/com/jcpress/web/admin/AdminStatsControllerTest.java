package com.jcpress.web.admin;

import cn.dev33.satoken.stp.StpUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 看板四个查询的鉴权与形状。
 *
 * 登录态直接由 Sa-Token 的 `createLoginSession` 造出来，不走登录接口 ——
 * 这条链路（口令校验、失败锁定）已经有 `AdminAuthControllerTest` 守着，
 * 这里再造一次只会把「看板能不能取数」和「登录能不能登」两件事耦在一起。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminStatsControllerTest {

    @Autowired
    MockMvc mockMvc;

    @AfterEach
    void logout() {
        StpUtil.getStpLogic().logout(1L);
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/v1/admin/stats/overview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40101));

        mockMvc.perform(get("/v1/admin/stats/trend"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/stats/articles"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/stats/hours"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/stats/paths"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void overviewReturnsCountsAsNumbers() throws Exception {
        String token = StpUtil.getStpLogic().createLoginSession(1L);

        mockMvc.perform(get("/v1/admin/stats/overview").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                // 计数必须是数字（ID 才是字符串）；写成 "0" 的话前端加号会变拼接
                .andExpect(jsonPath("$.data.todayPv").isNumber())
                .andExpect(jsonPath("$.data.todayUv").isNumber())
                .andExpect(jsonPath("$.data.last7Pv").isNumber())
                .andExpect(jsonPath("$.data.totalView").isNumber())
                // 不给「7 日 UV」这个字段 —— 按日去重的 UV 不能相加
                .andExpect(jsonPath("$.data.last7Uv").doesNotExist());
    }

    @Test
    void fourQueriesAllAnswerWhenLoggedIn() throws Exception {
        String token = StpUtil.getStpLogic().createLoginSession(1L);

        mockMvc.perform(get("/v1/admin/stats/trend").param("days", "7").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(7));

        mockMvc.perform(get("/v1/admin/stats/articles").param("days", "30").param("limit", "5")
                        .header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(get("/v1/admin/stats/paths").param("days", "7").param("limit", "5")
                        .header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // 访问时段：固定 24 条（0–23 点），前端据此画柱子
        mockMvc.perform(get("/v1/admin/stats/hours").param("days", "7")
                        .header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(24))
                .andExpect(jsonPath("$.data[0].hour").value(0))
                .andExpect(jsonPath("$.data[23].hour").value(23));
    }
}
