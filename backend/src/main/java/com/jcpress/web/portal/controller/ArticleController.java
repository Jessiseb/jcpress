package com.jcpress.web.portal.controller;

import com.jcpress.common.result.PageResult;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 技术分享公开接口（零鉴权、只读；唯一写路径是幂等的浏览量上报）。
 *
 * 类级 {@code @RequestMapping} 只给路径前缀 —— 方法级全部是明确的 {@code @GetMapping}
 * 或 {@code @PostMapping}，这正是架构卡口要的形状。
 */
@RestController
@RequestMapping("/v1/articles")
@RequiredArgsConstructor
@Tag(name = "技术分享（公开）")
public class ArticleController {

    private final ArticleService articleService;

    @GetMapping
    @Operation(summary = "公开列表（只含已发布、不含正文）")
    public Result<PageResult<ArticleCardVO>> list(ArticleQuery query) {
        return Result.success(articleService.listPublished(query));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "文章详情（Markdown 原文 + 内联相邻篇）")
    public Result<ArticleDetailVO> detail(@PathVariable String slug) {
        return Result.success(articleService.getPublishedDetail(slug));
    }

    @PostMapping("/{slug}/view")
    @Operation(summary = "浏览量 +1（按 ip + ua 按天去重，幂等）")
    public Result<Void> view(@PathVariable String slug, HttpServletRequest request) {
        articleService.saveView(slug, IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }
}
