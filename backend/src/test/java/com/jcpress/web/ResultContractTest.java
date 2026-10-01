package com.jcpress.web;

import com.jcpress.common.exception.GlobalExceptionHandler;
import com.jcpress.web.support.ExceptionProbeController;
import com.jcpress.web.support.WebSliceTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 统一响应体与异常映射的契约测试。
 *
 * 这是模板没做到、而规划 §9.1 明确要求的一条：**HTTP 状态码与业务码必须同时正确**
 * （官方模板一律返回 HTTP 200，再靠 code 区分）。
 */
@WebSliceTest(controllers = ExceptionProbeController.class)
@Import(GlobalExceptionHandler.class)
class ResultContractTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void businessExceptionCarriesMatchingHttpStatusAndCode() throws Exception {
        mockMvc.perform(get("/probe/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(40401))
                .andExpect(jsonPath("$.message").value("文章不存在"))
                // 用 nullValue 而不是 doesNotExist：Gson 开了 serializeNulls，null 字段会以 "data":null 出现
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void unexpectedExceptionIsMaskedAsSystemError() throws Exception {
        mockMvc.perform(get("/probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value(50000))
                .andExpect(jsonPath("$.message").value("系统异常"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("内部细节不应外泄"))));
    }
}
