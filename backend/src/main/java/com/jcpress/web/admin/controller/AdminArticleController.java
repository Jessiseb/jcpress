package com.jcpress.web.admin.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.result.PageResult;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;
import com.jcpress.service.AdminArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台文章管理（全部需要登录，由 Sa-Token 拦截器统一守护）。
 *
 * 方法规约（Agent.md）：读用 GET，写一律 POST；**状态迁移用路径后缀**表达
 * （`/{id}/publish`、`/{id}/delete`），不引入 PUT/PATCH/DELETE。
 */
@RestController
@RequestMapping("/v1/admin/articles")
@RequiredArgsConstructor
@Tag(name = "后台文章管理")
public class AdminArticleController {

    private final AdminArticleService adminArticleService;

    @GetMapping
    @Operation(summary = "内容列表（含草稿，可按状态/分类/关键词筛选）")
    public Result<PageResult<AdminArticleVO>> list(AdminArticleQuery query) {
        return Result.success(adminArticleService.listForAdmin(query));
    }

    @GetMapping("/{id}")
    @Operation(summary = "编辑用详情（含 Markdown 正文）")
    public Result<AdminArticleVO> detail(@PathVariable Long id) {
        return Result.success(adminArticleService.getForAdmin(id));
    }

    @PostMapping
    @Operation(summary = "新建文章")
    public Result<String> save(@RequestBody @Valid ArticleSaveDTO dto, HttpServletRequest request) {
        Long id = adminArticleService.saveArticle(dto, currentAdminId(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success(String.valueOf(id));
    }

    @PostMapping("/{id}")
    @Operation(summary = "更新文章")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid ArticleUpdateDTO dto,
                               HttpServletRequest request) {
        dto.setId(id);
        adminArticleService.updateArticle(dto, currentAdminId(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }

    @PostMapping("/{id}/publish")
    @Operation(summary = "发布 / 撤回 / 归档（status: 1 / 0 / 2）")
    public Result<Void> publish(@PathVariable Long id, @RequestParam Integer status,
                                HttpServletRequest request) {
        adminArticleService.updateStatus(id, status, currentAdminId(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }

    @PostMapping("/{id}/delete")
    @Operation(summary = "删除文章（连带正文与标签关系）")
    public Result<Void> remove(@PathVariable Long id, HttpServletRequest request) {
        adminArticleService.removeArticle(id, currentAdminId(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent"));
        return Result.success();
    }

    private Long currentAdminId() {
        return StpUtil.getLoginIdAsLong();
    }
}
