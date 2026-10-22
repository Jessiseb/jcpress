package com.jcpress.web.portal;

import com.jcpress.common.constant.RedisKeyConstant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 采集接口的真实链路测试。
 *
 * 用 `@SpringBootTest` 而不是切片：这里要验的正是「限流真的接在 Redis 上」「路径规范化真的发生在
 * Service 里」—— 切片把 Service mock 掉，这两条就都验不到了。
 *
 * 每个用例换一个来源 IP：限流键是 `rate:{ip}:pageview`，共用一个 IP 会让后面的用例撞上前面
 * 留下的计数（那是测试互相污染，不是产品缺陷）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StatsControllerTest {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    StringRedisTemplate redis;

    private String ip;

    @BeforeEach
    void cleanBefore() {
        ip = "10.88.1." + (System.nanoTime() % 200 + 1);
        clean();
    }

    @AfterEach
    void cleanAfter() {
        clean();
    }

    private void clean() {
        redis.delete(RedisKeyConstant.RATE_LIMIT.formatted(ip, "pageview"));
        redis.delete(RedisKeyConstant.STAT_DAY.formatted(LocalDate.now().format(DAY)));
        redis.delete(RedisKeyConstant.STAT_UV.formatted(LocalDate.now().format(DAY)));
    }

    private MockHttpServletRequestBuilder report(String body) {
        return post("/v1/stats/pageview")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                });
    }

    @Test
    void normalReportCountsOneView() throws Exception {
        mockMvc.perform(report("{\"path\":\"/tech\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        Map<Object, Object> entries = redis.opsForHash()
                .entries(RedisKeyConstant.STAT_DAY.formatted(LocalDate.now().format(DAY)));
        assertThat(entries.get(RedisKeyConstant.STAT_FIELD_PV)).isEqualTo("1");
        assertThat(entries.get(RedisKeyConstant.STAT_FIELD_UV)).isEqualTo("1");
        assertThat(entries.get(RedisKeyConstant.STAT_PATH_PREFIX + "/tech")).isEqualTo("1");
    }

    @Test
    void queryStringIsStrippedServerSide() throws Exception {
        mockMvc.perform(report("{\"path\":\"/tech?tag=java#top\"}"))
                .andExpect(status().isOk());

        Map<Object, Object> entries = redis.opsForHash()
                .entries(RedisKeyConstant.STAT_DAY.formatted(LocalDate.now().format(DAY)));
        assertThat(entries).containsKey(RedisKeyConstant.STAT_PATH_PREFIX + "/tech");
    }

    @Test
    void pathWithoutLeadingSlashIsRejected() throws Exception {
        mockMvc.perform(report("{\"path\":\"tech\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void tooLongPathIsRejected() throws Exception {
        String longPath = "/" + "a".repeat(500);
        mockMvc.perform(report("{\"path\":\"" + longPath + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void adminPathIsIgnoredSilently() throws Exception {
        // 前端不上报后台路由，但接口是公开的 —— 服务端也要兜住，
        // 否则「后台访问不计入统计」这句话只在浏览器里成立
        mockMvc.perform(report("{\"path\":\"/admin/dashboard\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        assertThat(redis.opsForHash()
                .entries(RedisKeyConstant.STAT_DAY.formatted(LocalDate.now().format(DAY))))
                .doesNotContainKey(RedisKeyConstant.STAT_PATH_PREFIX + "/admin/dashboard");
    }

    @Test
    void blankPathIsRejected() throws Exception {
        mockMvc.perform(report("{\"path\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    /**
     * 限流：第 121 次被挡。
     *
     * 这条**不接受**「偶发通过」—— 固定窗口计数是确定性的，所以循环次数与阈值必须对齐
     * （阈值 120 写在 RedisKeyConstant 里，改阈值这条断言会跟着红，这是有意的）。
     */
    @Test
    void moreThanLimitPerMinuteIsRejected() throws Exception {
        int limit = RedisKeyConstant.PAGEVIEW_RATE_LIMIT_PER_MINUTE;
        for (int i = 0; i < limit; i++) {
            mockMvc.perform(report("{\"path\":\"/\"}")).andExpect(status().isOk());
        }

        mockMvc.perform(report("{\"path\":\"/\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(42901));
    }
}
