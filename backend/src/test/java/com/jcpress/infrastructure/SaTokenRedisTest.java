package com.jcpress.infrastructure;

import com.jcpress.infrastructure.support.SaTokenProbeController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ★ 全期最关键的一条运行时验证：Sa-Token 1.44.0 + Spring Boot 3.3.4 + **本机 Redis 5.0.14**。
 *
 * 失败时的处置（见 openspec design D-D）：改用自研 {@code SaTokenDao}（只用 SETEX / EXPIRE /
 * RENAME 这些 Redis 5 就有的命令），并把结论回写 docs/decisions.md。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(SaTokenProbeController.class)
@ActiveProfiles("test")
class SaTokenRedisTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    StringRedisTemplate redis;

    @AfterEach
    void clearProbeKeys() {
        Set<String> keys = redis.keys("jcpress-token*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    @Test
    void loginRoundTripsThroughLocalRedis5() throws Exception {
        // ① 登录：签发 token 并写入 Redis（键前缀取自 token-name）
        MvcResult login = mockMvc.perform(post("/probe/satoken/login"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tokenName").value("jcpress-token"))
                .andReturn();
        String token = com.jayway.jsonpath.JsonPath.read(
                login.getResponse().getContentAsString(), "$.data.token");
        assertThat(token).isNotBlank();

        Set<String> keys = redis.keys("jcpress-token*");
        assertThat(keys).as("会话必须写进 Redis（键前缀取自 token-name）").isNotEmpty();

        // ② 按 token 反查登录主体：走 SaTokenDao 的读路径
        mockMvc.perform(get("/probe/satoken/whoami").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginId").value("1001"));

        // ③ 续期：1.46.0 在这里用 SET ... KEEPTTL（Redis 5 不支持）—— 1.44.0 必须能过
        mockMvc.perform(post("/probe/satoken/renew").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.renewed").value(true));

        // ④ 续期后仍可反查：证明 token 索引没被续期弄坏
        mockMvc.perform(get("/probe/satoken/whoami").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginId").value("1001"));

        // ⑤ 登出后同一个 token 失效：必须是 401（不是 500），且走 TOKEN_INVALID 口径
        mockMvc.perform(post("/probe/satoken/logout").header("jcpress-token", token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/probe/satoken/whoami").header("jcpress-token", token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40102));
    }
}
