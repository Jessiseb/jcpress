package com.jcpress.web.admin.controller;

import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.vo.AdminUserVO;
import com.jcpress.domain.vo.LoginVO;
import com.jcpress.service.AdminAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台认证接口。`/login` 由 Sa-Token 拦截器显式放行（其余 `/v1/admin/**` 都需要登录）。
 *
 * 写操作一律 POST（Agent.md），读一律 GET —— 连登出也是 POST，因为它改状态。
 */
@RestController
@RequestMapping("/v1/admin/auth")
@RequiredArgsConstructor
@Tag(name = "后台认证")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @PostMapping("/login")
    @Operation(summary = "登录（无需鉴权，受限流与失败锁定）")
    public Result<LoginVO> login(@RequestBody @Valid AdminLoginDTO dto, HttpServletRequest request) {
        return Result.success(adminAuthService.login(dto, IpUtils.getClientIp(request),
                request.getHeader("User-Agent")));
    }

    @PostMapping("/logout")
    @Operation(summary = "登出")
    public Result<Void> logout(HttpServletRequest request) {
        adminAuthService.logout(IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }

    @GetMapping("/me")
    @Operation(summary = "当前登录账号（不含口令哈希）")
    public Result<AdminUserVO> me() {
        return Result.success(adminAuthService.getCurrentAdmin());
    }
}
