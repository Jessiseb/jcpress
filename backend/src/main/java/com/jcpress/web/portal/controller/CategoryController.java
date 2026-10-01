package com.jcpress.web.portal.controller;

import com.jcpress.common.result.Result;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/categories")
@RequiredArgsConstructor
@Tag(name = "分类（公开）")
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @Operation(summary = "分类列表（含已发布计数；scope 默认 TECH）")
    public Result<List<CategoryVO>> list(@RequestParam(required = false) String scope) {
        return Result.success(categoryService.listByScope(scope));
    }
}
