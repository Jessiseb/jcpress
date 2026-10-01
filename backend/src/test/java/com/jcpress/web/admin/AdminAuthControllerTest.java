package com.jcpress.web.admin;

import com.google.gson.Gson;
import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.infrastructure.config.GsonConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 认证接口的**真实链路**测试（`@SpringBootTest` + MockMvc，不用切片）。
 *
 * 为什么不用 @WebMvcTest：切片里 Sa-Token 的自动配置不生效，SaTokenContext 未初始化，
 * 拦截器一取请求就抛异常、任何请求都变 500（见 docs/decisions.md #104）。
 * 而这里恰恰要验拦截器与 401 口径 —— 必须在真实上下文里跑。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAuthControllerTest {

    private static final String TEST_IP = "127.0.0.1";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    StringRedisTemplate redis;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private final Gson gson = GsonConfig.buildGson();

    @BeforeEach
    @AfterEach
    void clearCounters() {
        redis.delete(RedisKeyConstant.LOGIN_FAIL.formatted("admin"));
        redis.delete(RedisKeyConstant.RATE_LIMIT.formatted(TEST_IP, "login"));
    }

    private String loginAsAdmin() throws Exception {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername("admin");
        dto.setPassword("jcpress@2026");

        MvcResult result = mockMvc.perform(post("/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(gson.toJson(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenName").value("jcpress-token"))
                .andExpect(jsonPath("$.data.admin.username").value("admin"))
                .andExpect(jsonPath("$.data.admin.role").value("ADMIN"))
                // 口令哈希绝不能出现在响应里。注意这里用 doesNotExist 而不是 nullValue：
                // AdminUserVO 上根本没有 passwordHash 字段，所以它**不出现**；
                // serializeNulls 只作用于"已声明但值为 null"的字段（那种情况才该用 nullValue）。
                .andExpect(jsonPath("$.data.admin.passwordHash").doesNotExist())
                .andReturn();

        return com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.token");
    }

    @Test
    void meWithoutTokenIsUnauthorizedWith40101() throws Exception {
        mockMvc.perform(get("/v1/admin/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40101));
    }

    @Test
    void forgedTokenIsUnauthorizedWith40102() throws Exception {
        mockMvc.perform(get("/v1/admin/auth/me").header("jcpress-token", "not-a-real-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40102));
    }

    @Test
    void otherAdminRoutesAreAlsoProtected() throws Exception {
        // 拦截器是 /v1/admin/** 全匹配，不只是 auth/me
        mockMvc.perform(get("/v1/admin/articles"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40101));
    }

    @Test
    void successfulLoginIssuesTokenThatWorksOnMeAndClearsFailureCounter() throws Exception {
        // 先制造一次失败，验证成功登录会把计数清掉
        AdminLoginDTO wrong = new AdminLoginDTO();
        wrong.setUsername("admin");
        wrong.setPassword("wrong-password");
        mockMvc.perform(post("/v1/admin/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(wrong)));
        assertThat(redis.opsForValue().get("login:fail:admin")).isEqualTo("1");

        String token = loginAsAdmin();
        assertThat(redis.hasKey("login:fail:admin")).isFalse();

        mockMvc.perform(get("/v1/admin/auth/me").header("jcpress-token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("admin"));
    }

    @Test
    void logoutInvalidatesTheToken() throws Exception {
        String token = loginAsAdmin();

        mockMvc.perform(post("/v1/admin/auth/logout").header("jcpress-token", token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/v1/admin/auth/me").header("jcpress-token", token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40102));
    }

    @Test
    void blankUsernameIsRejectedAsParameterErrorNotServerError() throws Exception {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername("   ");
        dto.setPassword("jcpress@2026");

        mockMvc.perform(post("/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void successfulLoginIsAudited() throws Exception {
        loginAsAdmin();

        Integer auditCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE action = 'LOGIN'", Integer.class);
        assertThat(auditCount).isGreaterThanOrEqualTo(1);
    }
}
