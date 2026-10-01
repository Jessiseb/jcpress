package com.jcpress.web.portal.controller;

import com.jcpress.common.result.Result;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.service.TagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/tags")
@RequiredArgsConstructor
@Tag(name = "标签（公开）")
public class TagController {

    private final TagService tagService;

    @GetMapping
    @Operation(summary = "标签列表（含已发布计数）")
    public Result<List<TagVO>> list() {
        return Result.success(tagService.listWithCount());
    }
}
