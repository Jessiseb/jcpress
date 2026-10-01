package com.jcpress.infrastructure.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.jcpress.infrastructure.gson.LocalDateAdapter;
import com.jcpress.infrastructure.gson.LocalDateTimeAdapter;
import com.jcpress.infrastructure.gson.LongToStringAdapter;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.GsonHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 用 Gson 取代 Spring 默认的 Jackson（规划 §5.4）。
 *
 * 关键点：
 * 1. 转换器插到 **converters 第 0 位**才覆盖得掉默认 Jackson；
 * 2. **不要把 Jackson 从 classpath 摘掉** —— Sa-Token starter 自带 sa-token-jackson，
 *    只服务它自己的会话序列化；
 * 3. 副作用要记住：Jackson 注解（{@code @JsonProperty} / {@code @JsonFormat}）在本项目**全部失效**，
 *    需要改字段名时用 {@code @SerializedName}。
 */
@Configuration
public class GsonConfig implements WebMvcConfigurer {

    /** 静态工厂：测试直接复用它，避免测试里重建一套配置而与生产漂移 */
    public static Gson buildGson() {
        return new GsonBuilder()
                .serializeNulls()
                .disableHtmlEscaping()
                .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
                .registerTypeAdapter(LocalDate.class, new LocalDateAdapter())
                .registerTypeAdapter(Long.class, new LongToStringAdapter())
                .registerTypeAdapter(Long.TYPE, new LongToStringAdapter())
                .create();
    }

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        GsonHttpMessageConverter converter = new GsonHttpMessageConverter(buildGson());
        converter.setSupportedMediaTypes(List.of(MediaType.APPLICATION_JSON));
        converters.add(0, converter);
    }
}
