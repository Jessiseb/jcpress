package com.jcpress.service;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.vo.ArticleStatsVO;
import com.jcpress.domain.vo.HourStatsVO;
import com.jcpress.domain.vo.PathStatsVO;
import com.jcpress.domain.vo.StatsOverviewVO;
import com.jcpress.domain.vo.VisitTrendVO;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleViewStatMapper;
import com.jcpress.repository.VisitStatMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 统计查询的行为测试（跑真库）。
 *
 * 每个用例前把三张日聚合表清空 —— 它们全是**派生数据**，没有业务主数据在里面，
 * 清掉不损失任何东西，反而让断言不受别的测试类留下的行影响。
 */
@SpringBootTest
@ActiveProfiles("test")
class StatsServiceTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired
    StatsService statsService;

    @Autowired
    VisitStatMapper visitStatMapper;

    @Autowired
    ArticleViewStatMapper articleViewStatMapper;

    @Autowired
    ArticleMapper articleMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private Long tieArticleId;
    private Long hotArticleId;

    @BeforeEach
    void cleanStats() {
        jdbcTemplate.update("DELETE FROM visit_daily");
        jdbcTemplate.update("DELETE FROM visit_path_daily");
        jdbcTemplate.update("DELETE FROM article_view_daily");
        jdbcTemplate.update("DELETE FROM visit_hourly");
    }

    @AfterEach
    void removeProbeArticles() {
        if (tieArticleId != null) {
            articleMapper.deleteById(tieArticleId);
        }
        if (hotArticleId != null) {
            articleMapper.deleteById(hotArticleId);
        }
    }

    @Test
    void trendFillsMissingDaysWithZero() {
        visitStatMapper.saveDaily(TODAY.minusDays(2), 3, 1);
        visitStatMapper.saveDaily(TODAY, 5, 2);

        List<VisitTrendVO> trend = statsService.listTrend(3);

        assertThat(trend).hasSize(3);
        assertThat(trend.get(0).getDate()).isEqualTo(TODAY.minusDays(2));
        assertThat(trend.get(0).getPv()).isEqualTo(3);
        // 中间那天没有任何记录：必须是 0，而不是缺失或 null
        assertThat(trend.get(1).getPv()).isZero();
        assertThat(trend.get(1).getUv()).isZero();
        assertThat(trend.get(2).getPv()).isEqualTo(5);
    }

    @Test
    void trendClampsDaysToOneToNinety() {
        assertThat(statsService.listTrend(1000)).hasSize(90);
        assertThat(statsService.listTrend(0)).hasSize(1);
        assertThat(statsService.listTrend(-5)).hasSize(1);
    }

    @Test
    void overviewReadsTodayAndSevenDaySum() {
        visitStatMapper.saveDaily(TODAY, 5, 2);
        visitStatMapper.saveDaily(TODAY.minusDays(1), 4, 3);
        visitStatMapper.saveDaily(TODAY.minusDays(10), 100, 50);

        StatsOverviewVO overview = statsService.getOverview();

        assertThat(overview.getTodayPv()).isEqualTo(5);
        assertThat(overview.getTodayUv()).isEqualTo(2);
        assertThat(overview.getYesterdayPv()).isEqualTo(4);
        // 7 日窗口是「今天及前 6 天」，10 天前那 100 次不该进来（PV 可以相加，所以这里能验窗口）
        assertThat(overview.getLast7Pv()).isEqualTo(9);
    }

    @Test
    void deletedArticleKeepsRowWithPlaceholderTitle() {
        long ghostId = 999_999_002L;
        articleViewStatMapper.saveArticleDay(ghostId, TODAY, 4);

        List<ArticleStatsVO> stats = statsService.listArticleStats(7, 10);

        ArticleStatsVO ghost = stats.stream()
                .filter(item -> item.getId() != null && item.getId() == ghostId)
                .findFirst()
                .orElseThrow();
        assertThat(ghost.getTitle()).isEqualTo("（已删除）");
        assertThat(ghost.getPeriodView()).isEqualTo(4);
        assertThat(ghost.getTotalView()).isZero();
    }

    @Test
    void articleRankBreaksTieByTotalView() {
        tieArticleId = insertArticle("stats-tie-probe", 10);
        hotArticleId = insertArticle("stats-hot-probe", 40);
        // 期间内都是 3 次 —— 谁排前面只由累计数决定
        articleViewStatMapper.saveArticleDay(tieArticleId, TODAY, 3);
        articleViewStatMapper.saveArticleDay(hotArticleId, TODAY, 3);

        List<ArticleStatsVO> stats = statsService.listArticleStats(7, 10);

        List<Long> ids = stats.stream().map(ArticleStatsVO::getId).toList();
        assertThat(ids.indexOf(hotArticleId)).isLessThan(ids.indexOf(tieArticleId));
    }

    @Test
    void hourDistributionFillsAll24Hours() {
        // 只写 9 点与 21 点，其余 22 个小时必须补 0（而不是缺席）
        visitStatMapper.saveHour(TODAY, 9, 4);
        visitStatMapper.saveHour(TODAY.minusDays(1), 9, 3);
        visitStatMapper.saveHour(TODAY, 21, 7);

        List<HourStatsVO> hours = statsService.listHourStats(7);

        assertThat(hours).hasSize(24);
        assertThat(hours.get(9).getPv()).isEqualTo(7);
        assertThat(hours.get(21).getPv()).isEqualTo(7);
        assertThat(hours.get(3).getPv()).isZero();
        assertThat(hours).extracting(HourStatsVO::getHour)
                .containsExactlyElementsOf(java.util.stream.IntStream.range(0, 24).boxed().toList());
    }

    @Test
    void hourDistributionIgnoresDaysOutsideRange() {
        visitStatMapper.saveHour(TODAY.minusDays(10), 9, 100);
        visitStatMapper.saveHour(TODAY, 9, 2);

        List<HourStatsVO> hours = statsService.listHourStats(7);

        assertThat(hours.get(9).getPv()).isEqualTo(2);
    }

    @Test
    void pathRankExcludesAdminPaths() {
        visitStatMapper.savePath(TODAY, "/admin/dashboard", 99);
        visitStatMapper.savePath(TODAY, "/tech", 5);

        List<PathStatsVO> paths = statsService.listPathStats(7, 10);

        assertThat(paths).extracting(PathStatsVO::getPath).containsExactly("/tech");
    }

    @Test
    void pathLimitIsClamped() {
        for (int i = 0; i < 60; i++) {
            visitStatMapper.savePath(TODAY, "/probe/" + i, i + 1);
        }

        List<PathStatsVO> paths = statsService.listPathStats(7, 999);

        assertThat(paths).hasSize(50);
    }

    private Long insertArticle(String slug, int viewCount) {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("统计探针 " + slug);
        article.setSlug(slug);
        article.setStatus(1);
        article.setWordCount(10);
        article.setReadingMinutes(1);
        article.setViewCount(viewCount);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.now());
        articleMapper.insert(article);
        return article.getId();
    }
}
