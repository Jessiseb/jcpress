package com.jcpress.web.admin.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.AiFormatDTO;
import com.jcpress.domain.vo.AiFormatVO;
import com.jcpress.service.AiFormatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台 AI 辅助。走 `/v1/admin/**`，鉴权由 Sa-Token 拦截器统一覆盖。
 *
 * 只提供「生成建议」，**不落库** —— 用户要的是"先看对比再决定采纳哪些字段"，
 * 所以这里返回结果由前端拿去做 diff，写入仍走原有的文章保存接口。
 */
@RestController
@RequestMapping("/v1/admin/ai")
@RequiredArgsConstructor
@Tag(name = "后台 AI 辅助")
public class AdminAiController {

    private final AiFormatService aiFormatService;

    @PostMapping("/format")
    @Operation(summary = "AI 排版：整理 Markdown 并抽取摘要 / 标签 / slug（不落库）")
    public Result<AiFormatVO> format(@Valid @RequestBody AiFormatDTO dto, HttpServletRequest request) {
        return Result.success(aiFormatService.formatArticle(dto, StpUtil.getLoginIdAsLong(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent")));
    }
}
