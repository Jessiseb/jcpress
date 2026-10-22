package com.jcpress.service;

import com.jcpress.domain.vo.ArticleStatsVO;
import com.jcpress.domain.vo.PathStatsVO;
import com.jcpress.domain.vo.StatsOverviewVO;
import com.jcpress.domain.vo.VisitTrendVO;

import java.util.List;

/**
 * 站点统计。
 *
 * 写入侧只有 {@link #savePageView}（公开、匿名、幂等去重）；读取侧四条都是后台用。
 * 采集的限流与路径校验放在这一层而不是 Controller：Controller 只做参数接收与编排
 * （Agent.md 分层要求），且它不该依赖 Manager。
 */
public interface StatsService {

    /** 记一次页面访问（会做路径规范化、格式校验与按 IP 限流） */
    void savePageView(String path, String clientIp, String userAgent);

    StatsOverviewVO getOverview();

    /** 近 days 天的逐日 PV / UV，缺日补 0，升序 */
    List<VisitTrendVO> listTrend(int days);

    /** 期间文章阅读排行 */
    List<ArticleStatsVO> listArticleStats(int days, int limit);

    /** 期间热门页面 */
    List<PathStatsVO> listPathStats(int days, int limit);
}
