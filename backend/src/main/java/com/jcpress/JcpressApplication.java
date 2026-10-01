package com.jcpress;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * jcpress 后端入口。
 *
 * 与官方模板的两处关键差别：
 * 1. 模板用 {@code exclude = RedisAutoConfiguration.class} 换取"不用装 Redis 也能起"，
 *    本站必须要 Redis（Sa-Token 会话、浏览量去重、失败锁定与限流），所以**不排除任何自动配置**
 *    —— 依赖缺失应当表现为启动失败，而不是静默降级。
 * 2. {@code @MapperScan} **不在这里**，在 {@code MyBatisPlusConfig} 上：挂在启动类上会让
 *    `@WebMvcTest` 切片也去注册 Mapper Bean，而切片没有 DataSource，所有切片测试会一起挂。
 */
@SpringBootApplication
@EnableScheduling
public class JcpressApplication {

    public static void main(String[] args) {
        SpringApplication.run(JcpressApplication.class, args);
    }
}
