package com.jcpress.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

/**
 * 静态资源映射：把上传目录挂到 {@code /uploads/**}。
 *
 * 注意这里是**相对 context-path** 的路径：因为 {@code server.servlet.context-path=/api}，
 * 文件最终对外是 {@code /api/uploads/...}。而写进 Markdown 的 URL 由
 * {@code jcpress.upload.public-prefix} 决定（两处不能混用，见 LocalFileStorage 的类注释）。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final String uploadDir;
    private final String resourcePath;

    public WebMvcConfig(@Value("${jcpress.upload.dir:./uploads}") String uploadDir,
                        @Value("${jcpress.upload.resource-path:/uploads}") String resourcePath) {
        this.uploadDir = uploadDir;
        this.resourcePath = resourcePath;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 用 toUri()：Windows 上手拼 "file:" + 反斜杠路径会得到一个 Spring 解析不了的 location
        String location = Path.of(uploadDir).toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler(resourcePath + "/**").addResourceLocations(location);
    }
}
