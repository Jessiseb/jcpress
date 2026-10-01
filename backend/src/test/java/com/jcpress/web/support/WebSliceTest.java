package com.jcpress.web.support;

import com.jcpress.infrastructure.config.SaTokenConfigure;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.core.annotation.AliasFor;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 控制器切片测试的元注解：等价于 {@code @WebMvcTest}，但**排除 Sa-Token 的拦截器配置**。
 *
 * 为什么必须排除：{@code @WebMvcTest} 只加载 Web 相关自动配置，**不含 Sa-Token 的自动配置**，
 * 因此 `SaTokenContext` 从未初始化。而 `SaInterceptor.preHandle` 里第一件事就是
 * `SaRouter.match(...)` → `SaHolder.getRequest()` → 抛
 * `SaTokenContextException: SaTokenContext 上下文尚未初始化`，表现为**任何请求都返回 500**
 * （连不归它管的 `/health` 也一样）。曾据此误判为异常映射写错。
 *
 * 排除是安全的：这个拦截器只守 `/v1/admin/**`，而切片测试要么测公开接口、要么测统一响应体契约，
 * 本来就不该经过它。**需要验证鉴权链路 401 行为的测试必须用
 * `@SpringBootTest + @AutoConfigureMockMvc`（真实上下文），不要用切片**。
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@WebMvcTest(excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = SaTokenConfigure.class))
public @interface WebSliceTest {

    @AliasFor(annotation = WebMvcTest.class, attribute = "controllers")
    Class<?>[] controllers() default {};
}
