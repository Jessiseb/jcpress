package com.jcpress.web.portal;

import com.jcpress.service.HealthService;
import com.jcpress.web.portal.controller.HealthController;
import com.jcpress.web.support.WebSliceTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebSliceTest(controllers = HealthController.class)
class HealthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    HealthService healthService;

    @Test
    void healthIsPublicAndReturnsUnifiedBody() throws Exception {
        given(healthService.getHealth()).willReturn(Map.of("db", "UP", "redis", "UP"));

        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data.db").value("UP"))
                .andExpect(jsonPath("$.data.redis").value("UP"));
    }
}
