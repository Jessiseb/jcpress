package com.jcpress.web.support;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 只服务于契约测试的探针控制器。
 *
 * ⚠️ 必须是**顶层类**：写成测试类里的静态嵌套类时，`@WebMvcTest(controllers = ...)`
 * 不会把它注册成处理器，请求会落到静态资源兜底并抛 `NoResourceFoundException` ——
 * 表现是"异常处理器答了一个 500"，非常容易误判成异常映射写错了。
 */
@RestController
public class ExceptionProbeController {

    @GetMapping("/probe/not-found")
    public String notFound() {
        throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
    }

    @GetMapping("/probe/boom")
    public String boom() {
        throw new IllegalStateException("内部细节不应外泄");
    }
}
