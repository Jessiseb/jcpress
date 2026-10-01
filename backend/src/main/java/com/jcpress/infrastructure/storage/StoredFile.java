package com.jcpress.infrastructure.storage;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 一次成功落盘的结果（不可变）。
 *
 * 用 `private final` + `@Getter` + `@RequiredArgsConstructor` 而不是 `@Value`：
 * `@Value` 不在 Agent.md 的 Lombok 白名单里（只允许 @Data/@Getter/@Setter/@Slf4j，
 * 加上构造器注入必需的 @RequiredArgsConstructor），而这个名字卡口是有判据在守的。
 * 结果一样是不可变对象，区别只是没有自动生成的 equals/hashCode —— 这里也不需要。
 */
@Getter
@RequiredArgsConstructor
public class StoredFile {

    /** **对外可访问**的 URL，如 /api/uploads/2026/10/<32位随机>.png（含 context-path） */
    private final String url;

    /** 落盘的绝对路径，便于排障与将来迁移 */
    private final String absolutePath;

    private final long size;
}
