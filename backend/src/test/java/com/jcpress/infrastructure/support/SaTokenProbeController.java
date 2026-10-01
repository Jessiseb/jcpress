package com.jcpress.infrastructure.support;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.result.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Sa-Token 运行时探针（**只存在于测试代码里**）。
 *
 * 为什么必须走 HTTP：`StpUtil.login()` / `getLoginId()` 需要 **web 请求级上下文**
 * （Sa-Token 从当前请求里取/写 token）。在 `@SpringBootTest` 的测试方法里直接调用会抛
 * `SaTokenContextException: 非 web 上下文无法获取 Request` —— 而那不是产品缺陷。
 *
 * 所以探针做成几个端点，由测试用 MockMvc 驱动，让整条链路（拦截器 → Sa-Token → Redis Dao）
 * 都真实地跑一遍。这条链路是全期唯一无法靠静态检查验证的高风险假设：
 * 本机 Redis 是 5.0.14，而 sa-token-redis-template 1.46.0 用了 Redis 6.0+ 的
 * `SET ... KEEPTTL`（1.44.0 没有，所以锁了 1.44.0）—— 但"没有那个命令"不等于"整条链路能用"。
 *
 * 返回值一律包 {@code Result}：与生产接口同一套响应体，测试断言才有意义。
 */
@RestController
@RequestMapping("/probe/satoken")
public class SaTokenProbeController {

    @PostMapping("/login")
    public Result<Map<String, Object>> login() {
        StpUtil.login(1001L);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", StpUtil.getTokenValue());
        result.put("tokenName", StpUtil.getTokenName());
        return Result.success(result);
    }

    @GetMapping("/whoami")
    public Result<Map<String, Object>> whoami() {
        Map<String, Object> result = new LinkedHashMap<>();
        // 经 Redis 序列化回来可能是 Long/Integer，统一成字符串比较，避免类型导致的假红
        result.put("loginId", String.valueOf(StpUtil.getLoginId()));
        return Result.success(result);
    }

    /** 续期：1.46.0 的 Dao 在这里用 SET ... KEEPTTL，Redis 5 会直接报 ERR syntax error */
    @PostMapping("/renew")
    public Result<Map<String, Object>> renew() {
        StpUtil.renewTimeout(60);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("renewed", true);
        return Result.success(result);
    }

    @PostMapping("/logout")
    public Result<Map<String, Object>> logout() {
        StpUtil.logout();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("loggedOut", true);
        return Result.success(result);
    }
}
