package com.jcpress.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 口令编码器。
 *
 * **只取 `BCryptPasswordEncoder` 这一个工具类，不引入 Spring Security 框架**（规划 §5.5）：
 * 前台完全公开、后台只有账号口令一种凭据，引整套安全框架只会多一堆默认行为与配置面。
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
