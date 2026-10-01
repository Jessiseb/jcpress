package com.jcpress.web.admin;

import com.google.gson.Gson;
import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.dto.ArticleSaveDTO;
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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 后台文章接口的**真实链路**测试（含 Sa-Token 拦截器）。
 *
 * 覆盖三条主线：未登录一律 401；列表含草稿而公开列表不含；新建 → 发布 → 前台可见。
 * 外加关键词的两条路径（全文索引 / 单字回退前缀匹配）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminArticleControllerTest {

    private static final String TEST_IP = "127.0.0.1";
    private static final String PROBE_SLUG = "controller-chain-probe";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    StringRedisTemplate redis;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private final Gson gson = GsonConfig.buildGson();
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        redis.delete(RedisKeyConstant.LOGIN_FAIL.formatted("admin"));
        redis.delete(RedisKeyConstant.RATE_LIMIT.formatted(TEST_IP, "login"));
        cleanProbeArticle();
        jdbcTemplate.update("DELETE FROM admin_audit_log WHERE detail LIKE '%probe%'");

        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername("admin");
        dto.setPassword("jcpress@2026");
        MvcResult result = mockMvc.perform(post("/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(dto)))
                .andExpect(status().isOk()).andReturn();
        token = com.jayway.jsonpath.JsonPath.read(
                result.getResponse().getContentAsString(), "$.data.token");
    }

    @AfterEach
    void tearDown() {
        cleanProbeArticle();
        jdbcTemplate.update("DELETE FROM admin_audit_log WHERE detail LIKE '%probe%'");
    }

    private void cleanProbeArticle() {
        jdbcTemplate.update("DELETE FROM article_tag WHERE article_id IN "
                + "(SELECT id FROM article WHERE slug = ?)", PROBE_SLUG);
        jdbcTemplate.update("DELETE FROM article_content WHERE article_id IN "
                + "(SELECT id FROM article WHERE slug = ?)", PROBE_SLUG);
        jdbcTemplate.update("DELETE FROM article WHERE slug = ?", PROBE_SLUG);
    }

    private Long firstTechCategoryId() {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM category WHERE scope = 'TECH' ORDER BY id LIMIT 1", Long.class);
    }

    private ArticleSaveDTO probeDto() {
        ArticleSaveDTO dto = new ArticleSaveDTO();
        dto.setTitle("接口链路验证文");
        dto.setSlug(PROBE_SLUG);
        dto.setSummary("摘要");
        dto.setCategoryId(firstTechCategoryId());
        dto.setTags(List.of("Redis"));
        dto.setContentMd("# 标题\n\n正文用于验证链路。");
        dto.setStatus(AdminConstant.ARTICLE_STATUS_DRAFT);
        return dto;
    }

    @Test
    void listWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/v1/admin/articles"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40101));
    }

    @Test
    void saveWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(post("/v1/admin/articles")
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(probeDto())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listIncludesDraftsWhilePublicListDoesNot() throws Exception {
        mockMvc.perform(get("/v1/admin/articles")
                        .header("jcpress-token", token)
                        .param("status", "0")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.data.list[0].status").value(0));

        // 公开列表在同一时刻看不到草稿 —— 直接看响应体里有没有那个 slug（比写 jsonPath 过滤器稳）
        MvcResult publicList = mockMvc.perform(get("/v1/articles")
                        .param("type", "TECH").param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(publicList.getResponse().getContentAsString())
                .doesNotContain("threadlocal-tool-context");
    }

    @Test
    void createThenPublishMakesItVisibleOnThePublicSide() throws Exception {
        MvcResult created = mockMvc.perform(post("/v1/admin/articles")
                        .header("jcpress-token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(probeDto())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isString())   // id 以字符串下发
                .andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data");

        // 未发布前公开侧拿不到
        mockMvc.perform(get("/v1/articles/" + PROBE_SLUG))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/v1/admin/articles/" + id + "/publish")
                        .header("jcpress-token", token).param("status", "1"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/v1/articles/" + PROBE_SLUG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(PROBE_SLUG))
                .andExpect(jsonPath("$.data.contentMd").value(org.hamcrest.Matchers.containsString("正文用于验证链路")));

        // 更新后标题生效
        ArticleSaveDTO update = probeDto();
        update.setTitle("改过的标题");
        mockMvc.perform(post("/v1/admin/articles/" + id)
                        .header("jcpress-token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(update)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/articles/" + PROBE_SLUG))
                .andExpect(jsonPath("$.data.title").value("改过的标题"));

        // 删除后公开侧与后台都拿不到
        mockMvc.perform(post("/v1/admin/articles/" + id + "/delete").header("jcpress-token", token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/articles/" + PROBE_SLUG)).andExpect(status().isNotFound());
        mockMvc.perform(get("/v1/admin/articles/" + id).header("jcpress-token", token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(40401));
    }

    @Test
    void twoCharKeywordUsesFulltextIndexAndSingleCharFallsBackToPrefixMatch() throws Exception {
        // 多字关键词：走 MATCH ... AGAINST('关键词*' IN BOOLEAN MODE)
        mockMvc.perform(get("/v1/admin/articles")
                        .header("jcpress-token", token).param("keyword", "后端"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(0)));

        // 单字：ngram_token_size=2 时全文索引命中 0，必须回退成 title LIKE '字%'
        mockMvc.perform(get("/v1/admin/articles")
                        .header("jcpress-token", token).param("keyword", "三"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.data.list[0].title")
                        .value(org.hamcrest.Matchers.startsWith("三期后端复盘")));
    }

    @Test
    void invalidStatusIsRejectedAsParameterError() throws Exception {
        MvcResult created = mockMvc.perform(post("/v1/admin/articles")
                        .header("jcpress-token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(probeDto())))
                .andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data");

        mockMvc.perform(post("/v1/admin/articles/" + id + "/publish")
                        .header("jcpress-token", token).param("status", "9"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void adminWritesAreAudited() throws Exception {
        mockMvc.perform(post("/v1/admin/articles")
                .header("jcpress-token", token)
                .contentType(MediaType.APPLICATION_JSON).content(gson.toJson(probeDto())));

        Integer audits = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE action = 'CREATE' AND detail LIKE ?",
                Integer.class, "%" + PROBE_SLUG + "%");
        assertThat(audits).isEqualTo(1);
    }
}
