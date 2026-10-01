package com.jcpress.web.portal;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.service.ArticleService;
import com.jcpress.web.portal.controller.ArticleController;
import com.jcpress.web.support.WebSliceTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.times;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 公开接口的响应形状（切片测试：Service 打桩，只验契约与路径）。
 *
 * 用 {@link WebSliceTest} 而不是 @WebMvcTest —— 后者会把 Sa-Token 拦截器一起加载，
 * 而切片里 Sa-Token 的上下文没初始化，任何请求都会 500（见 docs/decisions.md #104）。
 */
@WebSliceTest(controllers = ArticleController.class)
class ArticleControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    ArticleService articleService;

    @Test
    void listReturnsPagedBodyWithStringSafeId() throws Exception {
        ArticleCardVO card = new ArticleCardVO();
        card.setId(1900000000000000001L);
        card.setSlug("phase-3-backend-retro");
        card.setTitle("三期后端复盘");
        card.setPublishTime(LocalDateTime.of(2026, 10, 2, 9, 0, 0));
        given(articleService.listPublished(any())).willReturn(PageResult.of(List.of(card), 1, 20, 1));

        mockMvc.perform(get("/v1/articles").param("type", "TECH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pages").value(1))
                .andExpect(jsonPath("$.data.list[0].slug").value("phase-3-backend-retro"))
                // Long 必须序列化成字符串（Gson 适配器），否则 JS 侧会丢精度
                .andExpect(jsonPath("$.data.list[0].id").value("1900000000000000001"))
                // 时间格式由适配器统一
                .andExpect(jsonPath("$.data.list[0].publishTime").value("2026-10-02 09:00:00"));
    }

    @Test
    void detailReturnsMarkdownAndTraceId() throws Exception {
        ArticleDetailVO detail = new ArticleDetailVO();
        detail.setSlug("phase-3-backend-retro");
        detail.setContentMd("# 标题");
        given(articleService.getPublishedDetail(anyString())).willReturn(detail);

        mockMvc.perform(get("/v1/articles/phase-3-backend-retro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("phase-3-backend-retro"))
                .andExpect(jsonPath("$.data.contentMd").value("# 标题"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void viewIsPostAndForwardsClientFingerprint() throws Exception {
        mockMvc.perform(post("/v1/articles/phase-3-backend-retro/view").header("User-Agent", "JUnit-UA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        then(articleService).should(times(1))
                .saveView(org.mockito.ArgumentMatchers.eq("phase-3-backend-retro"), anyString(),
                        org.mockito.ArgumentMatchers.eq("JUnit-UA"));
    }
}
