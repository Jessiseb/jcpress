package com.jcpress.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 定时任务只在**非 CLI** 环境启用。
 *
 * 为什么必须加这个 profile 条件（踩过才知道）：Spring 的调度线程池是**非守护线程**，
 * 一旦启用，JVM 在 `ApplicationRunner` 干完活之后**不会退出** —— 导入器 CLI 因此挂住十几分钟。
 * 而且从语义上它本来也不该跑：CLI 导入一次内容，凭什么顺手把浏览量刷回数据库。
 *
 * 实测日志（挂住那次）：`[scheduling-1] ArticleViewManager : 浏览量回写完成…`。
 */
@Configuration
@EnableScheduling
@Profile("!importer")
public class SchedulingConfig {
}
