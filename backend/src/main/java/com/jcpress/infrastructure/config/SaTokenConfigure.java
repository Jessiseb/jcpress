package com.jcpress.infrastructure.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.router.SaRouter;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 后台鉴权拦截：只有 /v1/admin/** 需要登录，登录接口本身放行。
 *
 * 注意路径里**不写 /api** —— 拦截器的匹配路径不含 context-path。
 * 前台接口完全不受影响（零鉴权、也没有 token 概念）。
 */
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SaInterceptor(handle -> SaRouter
                        .match("/v1/admin/**")
                        .notMatch("/v1/admin/auth/login")
                        .check(r -> StpUtil.checkLogin())))
                .addPathPatterns("/**");
    }
}
