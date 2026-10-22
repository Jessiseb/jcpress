package com.jcpress.web.portal.controller;

import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.PageViewDTO;
import com.jcpress.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 访问采集（公开、零鉴权）。
 *
 * 这是本站唯一一个「浏览器主动打过来」的写接口，所以三道闸都在 Service 里：
 * 路径规范化 + 格式校验（服务端不信任客户端）+ 按 IP 限流
 * （公开接口不改 IP 也能被脚本灌，限流是最便宜的一道）。
 */
@RestController
@RequestMapping("/v1/stats")
@RequiredArgsConstructor
@Tag(name = "站点统计（公开）")
public class StatsController {

    private final StatsService statsService;

    @PostMapping("/pageview")
    @Operation(summary = "上报一次页面访问（按 ip + ua 按天去重，幂等）")
    public Result<Void> savePageView(@RequestBody @Valid PageViewDTO dto,
                                     HttpServletRequest request) {
        statsService.savePageView(dto.getPath(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }
}
