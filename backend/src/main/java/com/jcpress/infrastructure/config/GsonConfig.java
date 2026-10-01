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

    /**
     * 静态工厂：测试直接复用它，避免测试里重建一套配置而与生产漂移。
     *
     * ⚠️ **只给包装类型 `Long` 注册字符串适配器，不给 `long` 基本类型注册**。
     * 规则是：**ID 走字符串（防 JS 精度丢失），计数与度量走数字**。
     * 若把 `Long.TYPE` 也注册上，`PageResult.total/pages` 这类 `long` 字段会一起变成
     * `"3"` 这样的字符串 —— 与前端 `number` 类型和接口文档都不符，而且是**静默**的。
     * 所以：实体/VO 的 ID 字段声明为 `Long`，计数类字段声明为 `long`（或 `Integer`）。
     */
    public static Gson buildGson() {
        return new GsonBuilder()
                .serializeNulls()
                .disableHtmlEscaping()
                .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
                .registerTypeAdapter(LocalDate.class, new LocalDateAdapter())
                .registerTypeAdapter(Long.class, new LongToStringAdapter())
                .create();
    }

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        GsonHttpMessageConverter converter = new GsonHttpMessageConverter(buildGson());
        converter.setSupportedMediaTypes(List.of(MediaType.APPLICATION_JSON));
        converters.add(0, converter);
    }
}
