package com.jcpress.service.impl;

import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.projection.ArticleCountRef;
import com.jcpress.domain.projection.ArticleStatRef;
import com.jcpress.domain.projection.DailyPvUvRef;
import com.jcpress.domain.projection.HourStatRef;
import com.jcpress.domain.projection.PathStatRef;
import com.jcpress.domain.vo.ArticleStatsVO;
import com.jcpress.domain.vo.HourStatsVO;
import com.jcpress.domain.vo.PathStatsVO;
import com.jcpress.domain.vo.StatsOverviewVO;
import com.jcpress.domain.vo.VisitTrendVO;
import com.jcpress.manager.RateLimitManager;
import com.jcpress.manager.VisitStatManager;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleViewStatMapper;
import com.jcpress.repository.VisitStatMapper;
import com.jcpress.service.StatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class StatsServiceImpl implements StatsService {

    /** 区间上限：再长也不会有人看，而一次拉三年会让响应和扫描都变慢 */
    private static final int MAX_DAYS = 90;
    private static final int MAX_LIMIT = 50;
    /** 与 visit_path_daily.path 的列宽一致 */
    private static final int MAX_PATH_LENGTH = 160;
    /** 路径被规范化后落库；没 IP 时 IpUtils 回这个常量 */
    private static final String UNKNOWN_IP = "unknown";
    private static final int HOURS_PER_DAY = 24;

    private final VisitStatManager visitStatManager;
    private final RateLimitManager rateLimitManager;
    private final VisitStatMapper visitStatMapper;
    private final ArticleViewStatMapper articleViewStatMapper;
    private final ArticleMapper articleMapper;

    @Override
    public void savePageView(String path, String clientIp, String userAgent) {
        String normalized = normalizePath(path);
        if (normalized == null) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "路径格式不正确");
        }
        // 后台路径服务端也挡一道：前端已经不上报了，但接口是公开的，谁都能直接 POST。
        // 看板上写着「后台自身的访问不计入统计」，那句话得由服务端兜住才成立。
        if (isAdminPath(normalized)) {
            return;
        }
        // 拿不到来源 IP（本地回调、健康检查之类）就不计数，但**不能报错** ——
        // 上报方是浏览器埋点，为一条统计给访客抛错毫无意义
        if (clientIp == null || clientIp.isBlank() || UNKNOWN_IP.equalsIgnoreCase(clientIp)) {
            return;
        }
        boolean allowed = rateLimitManager.tryAcquire(
                RedisKeyConstant.RATE_LIMIT.formatted(clientIp, "pageview"),
                RedisKeyConstant.PAGEVIEW_RATE_LIMIT_PER_MINUTE,
                Duration.ofMinutes(1));
        if (!allowed) {
            throw new BusinessException(ErrorCodeEnum.RATE_LIMITED);
        }
        visitStatManager.saveVisit(normalized, clientIp, userAgent);
    }

    @Override
    public StatsOverviewVO getOverview() {
        LocalDate today = LocalDate.now();
        DailyPvUvRef todayRef = visitStatMapper.getDaily(today);
        DailyPvUvRef yesterdayRef = visitStatMapper.getDaily(today.minusDays(1));
        ArticleCountRef counts = articleMapper.countByType(null);

        StatsOverviewVO vo = new StatsOverviewVO();
        vo.setTodayPv(readCount(todayRef == null ? null : todayRef.getPv()));
        vo.setTodayUv(readCount(todayRef == null ? null : todayRef.getUv()));
        vo.setYesterdayPv(readCount(yesterdayRef == null ? null : yesterdayRef.getPv()));
        vo.setYesterdayUv(readCount(yesterdayRef == null ? null : yesterdayRef.getUv()));
        vo.setLast7Pv(readCount(visitStatMapper.countSumPvBetween(today.minusDays(6), today)));
        vo.setTotalView(readCount(articleMapper.countTotalView()));
        vo.setArticleCount(readCount(counts == null ? null : counts.getTotal()));
        vo.setPublishedCount(readCount(counts == null ? null : counts.getPublished()));
        return vo;
    }

    @Override
    public List<VisitTrendVO> listTrend(int days) {
        int span = clamp(days, MAX_DAYS);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(span - 1L);
        Map<LocalDate, DailyPvUvRef> rows = new HashMap<>();
        for (DailyPvUvRef row : visitStatMapper.listDailyBetween(from, today)) {
            rows.put(row.getStatDate(), row);
        }
        // 补齐空日：横轴上「没有数据的一天」和「这天不存在」必须长得不一样，
        // 否则折线会在缺口处被直接连过去，看着像一直有人来
        List<VisitTrendVO> trend = new ArrayList<>(span);
        for (int i = 0; i < span; i++) {
            LocalDate date = from.plusDays(i);
            DailyPvUvRef row = rows.get(date);
            VisitTrendVO point = new VisitTrendVO();
            point.setDate(date);
            point.setPv(readCount(row == null ? null : row.getPv()));
            point.setUv(readCount(row == null ? null : row.getUv()));
            trend.add(point);
        }
        return trend;
    }

    @Override
    public List<ArticleStatsVO> listArticleStats(int days, int limit) {
        int span = clamp(days, MAX_DAYS);
        int size = clamp(limit, MAX_LIMIT);
        LocalDate today = LocalDate.now();
        List<ArticleStatRef> rows =
                articleViewStatMapper.listArticleTop(today.minusDays(span - 1L), today, size);
        List<ArticleStatsVO> stats = new ArrayList<>(rows.size());
        for (ArticleStatRef row : rows) {
            ArticleStatsVO vo = new ArticleStatsVO();
            vo.setId(row.getArticleId());
            // 文章被删掉后日表记录还在（LEFT JOIN 拿到的 title 为 null）。
            // 这里补一个占位，而不是把整行丢掉 —— 那条记录本身就是「曾有人读」的证据
            vo.setTitle(row.getTitle() == null ? "（已删除）" : row.getTitle());
            vo.setSlug(row.getSlug());
            vo.setPeriodView(readCount(row.getPeriodView()));
            vo.setTotalView(readCount(row.getTotalView()));
            stats.add(vo);
        }
        return stats;
    }

    @Override
    public List<PathStatsVO> listPathStats(int days, int limit) {
        int span = clamp(days, MAX_DAYS);
        int size = clamp(limit, MAX_LIMIT);
        LocalDate today = LocalDate.now();
        List<PathStatRef> rows = visitStatMapper.listPathTop(today.minusDays(span - 1L), today, size);
        List<PathStatsVO> stats = new ArrayList<>(rows.size());
        for (PathStatRef row : rows) {
            PathStatsVO vo = new PathStatsVO();
            vo.setPath(row.getPath());
            vo.setPv(readCount(row.getPv()));
            stats.add(vo);
        }
        return stats;
    }

    @Override
    public List<HourStatsVO> listHourStats(int days) {
        int span = clamp(days, MAX_DAYS);
        LocalDate today = LocalDate.now();
        Map<Integer, Integer> byHour = new HashMap<>();
        for (HourStatRef row : visitStatMapper.listHourBetween(today.minusDays(span - 1L), today)) {
            byHour.put(row.getStatHour(), readCount(row.getPv()));
        }
        // 固定返回 24 条：横向的「凌晨 3 点没人来」和「这一小时不存在」必须区分开，
        // 缺项补齐才能让柱子之间的间距稳定（否则空小时会被挤掉，看起来像数据错位）
        List<HourStatsVO> hours = new ArrayList<>(HOURS_PER_DAY);
        for (int hour = 0; hour < HOURS_PER_DAY; hour++) {
            HourStatsVO vo = new HourStatsVO();
            vo.setHour(hour);
            vo.setPv(byHour.getOrDefault(hour, 0));
            hours.add(vo);
        }
        return hours;
    }

    /**
     * 规范化路径：剥掉 query 与 hash、去掉末尾斜杠（根路径除外）。
     *
     * 前端已经做过一次，这里再做一次是**服务端不信任客户端**：接口是公开的，
     * 任何人可以直接 POST `/tech?x=1`，不剥的话热门页面会出现无数条 `/tech?x=N`。
     *
     * @return null 表示不合法（不以 / 开头、含空白、超长）
     */
    private String normalizePath(String path) {
        if (path == null) {
            return null;
        }
        String trimmed = path.trim();
        int cut = indexOfAny(trimmed, '?', '#');
        if (cut >= 0) {
            trimmed = trimmed.substring(0, cut);
        }
        if (trimmed.length() > 1 && trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (trimmed.isEmpty() || !trimmed.startsWith("/") || trimmed.length() > MAX_PATH_LENGTH) {
            return null;
        }
        for (int i = 0; i < trimmed.length(); i++) {
            if (Character.isWhitespace(trimmed.charAt(i))) {
                return null;
            }
        }
        return trimmed;
    }

    /** `/admin` 与 `/admin/...` 都不算站点访问 */
    private boolean isAdminPath(String path) {
        return "/admin".equals(path) || path.startsWith("/admin/");
    }

    private int indexOfAny(String value, char first, char second) {        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == first || c == second) {
                return i;
            }
        }
        return -1;
    }

    private int clamp(int value, int max) {
        if (value < 1) {
            return 1;
        }
        return Math.min(value, max);
    }

    /** null 计数一律当 0：库里查不到那天就没有数据，不是「未知」 */
    private int readCount(Integer value) {
        return value == null ? 0 : value;
    }
}
