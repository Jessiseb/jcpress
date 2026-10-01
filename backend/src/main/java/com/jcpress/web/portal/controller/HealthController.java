package com.jcpress.web.portal.controller;

import com.jcpress.common.result.Result;
import com.jcpress.service.HealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 探活接口（公开、零鉴权）。注意路径里**不写 /api** —— 那是 context-path。
 */
@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
@Tag(name = "健康检查")
public class HealthController {

    private final HealthService healthService;

    @GetMapping
    @Operation(summary = "探活（含 DB 与 Redis）")
    public Result<Map<String, Object>> health() {
        return Result.success(healthService.check());
    }
}
