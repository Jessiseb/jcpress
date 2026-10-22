package com.jcpress.web.admin.controller;

import com.jcpress.common.result.Result;
import com.jcpress.domain.vo.ArticleStatsVO;
import com.jcpress.domain.vo.PathStatsVO;
import com.jcpress.domain.vo.StatsOverviewVO;
import com.jcpress.domain.vo.VisitTrendVO;
import com.jcpress.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 数据看板的四个查询（全部 GET、全部需要登录）。
 *
 * `days` / `limit` 的值不在这里夹：限幅属于业务约束，放 Service（design「接口」一节）。
 * 这里只给默认值，让「不传参数也能用」成立 —— 看板首屏就是不带参数调用的。
 */
@RestController
@RequestMapping("/v1/admin/stats")
@RequiredArgsConstructor
@Tag(name = "站点统计（后台）")
public class AdminStatsController {

    private final StatsService statsService;

    @GetMapping("/overview")
    @Operation(summary = "总览：今日/昨日 PV·UV、近 7 日 PV、累计阅读、内容数")
    public Result<StatsOverviewVO> overview() {
        return Result.success(statsService.getOverview());
    }

    @GetMapping("/trend")
    @Operation(summary = "逐日 PV / UV（缺日补 0，最多 90 天）")
    public Result<List<VisitTrendVO>> trend(@RequestParam(defaultValue = "30") int days) {
        return Result.success(statsService.listTrend(days));
    }

    @GetMapping("/articles")
    @Operation(summary = "文章阅读排行（期间 + 累计，最多 50 条）")
    public Result<List<ArticleStatsVO>> articles(@RequestParam(defaultValue = "30") int days,
                                                 @RequestParam(defaultValue = "10") int limit) {
        return Result.success(statsService.listArticleStats(days, limit));
    }

    @GetMapping("/paths")
    @Operation(summary = "热门页面（不含后台路径，最多 50 条）")
    public Result<List<PathStatsVO>> paths(@RequestParam(defaultValue = "7") int days,
                                           @RequestParam(defaultValue = "10") int limit) {
        return Result.success(statsService.listPathStats(days, limit));
    }
}
