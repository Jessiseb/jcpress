package com.jcpress.manager;

import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.domain.projection.DailyPvUvRef;
import com.jcpress.domain.projection.PathStatRef;
import com.jcpress.repository.VisitStatMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 站点统计 Manager：三条断言覆盖「UV 去重 / 回写落库 / 回写幂等」。
 *
 * 幂等那条是本期最容易被写错的地方 —— 如果把站点累计当成增量回写，
 * 定时任务每跑一次数字就翻一倍。这里用「连续回写两次，值不变」把它钉住。
 */
@SpringBootTest
@ActiveProfiles("test")
class VisitStatManagerTest {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired
    VisitStatManager visitStatManager;

    @Autowired
    VisitStatMapper visitStatMapper;

    @Autowired
    StringRedisTemplate redis;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private String statKey() {
        return RedisKeyConstant.STAT_DAY.formatted(TODAY.format(DAY));
    }

    private String uvKey() {
        return RedisKeyConstant.STAT_UV.formatted(TODAY.format(DAY));
    }

    @BeforeEach
    @AfterEach
    void clean() {
        redis.delete(statKey());
        redis.delete(uvKey());
        jdbcTemplate.update("DELETE FROM visit_daily WHERE stat_date = ?", TODAY);
        jdbcTemplate.update("DELETE FROM visit_path_daily WHERE stat_date = ?", TODAY);
        jdbcTemplate.update("DELETE FROM article_view_daily WHERE stat_date = ?", TODAY);
    }

    @Test
    void sameFingerprintCountsOneUvButEveryPv() {
        visitStatManager.saveVisit("/", "10.0.0.1", "JUnit");
        visitStatManager.saveVisit("/", "10.0.0.1", "JUnit");

        Map<Object, Object> entries = redis.opsForHash().entries(statKey());
        assertThat(entries.get(RedisKeyConstant.STAT_FIELD_PV)).isEqualTo("2");
        assertThat(entries.get(RedisKeyConstant.STAT_FIELD_UV)).isEqualTo("1");
        assertThat(entries.get(RedisKeyConstant.STAT_PATH_PREFIX + "/")).isEqualTo("2");
    }

    @Test
    void flushWritesSnapshotToDb() {
        visitStatManager.saveVisit("/", "10.0.0.1", "JUnit");
        visitStatManager.saveVisit("/tech", "10.0.0.2", "JUnit");

        visitStatManager.flushDaily();

        DailyPvUvRef daily = visitStatMapper.getDaily(TODAY);
        assertThat(daily).isNotNull();
        assertThat(daily.getPv()).isEqualTo(2);
        assertThat(daily.getUv()).isEqualTo(2);

        List<PathStatRef> paths = visitStatMapper.listPathTop(TODAY, TODAY, 10);
        assertThat(paths).extracting(PathStatRef::getPath).contains("/", "/tech");
    }

    @Test
    void flushIsIdempotent() {
        visitStatManager.saveVisit("/", "10.0.0.1", "JUnit");
        visitStatManager.flushDaily();
        visitStatManager.flushDaily();

        DailyPvUvRef daily = visitStatMapper.getDaily(TODAY);
        assertThat(daily.getPv()).isEqualTo(1);
        assertThat(daily.getUv()).isEqualTo(1);
    }

    @Test
    void flushWritesArticleDayEvenIfArticleGone() {
        // 不存在的 id 也能写：日表没有外键，文章删了「曾有人读」这条事实仍然成立
        long ghostId = 999_999_001L;
        visitStatManager.saveArticleView(ghostId);

        visitStatManager.flushDaily();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT view_count FROM article_view_daily WHERE article_id = ? AND stat_date = ?",
                Integer.class, ghostId, TODAY);
        assertThat(count).isEqualTo(1);
    }
}
