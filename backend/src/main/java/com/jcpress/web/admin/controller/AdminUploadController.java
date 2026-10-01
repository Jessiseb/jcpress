package com.jcpress.web.admin.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.result.Result;
import com.jcpress.common.util.IpUtils;
import com.jcpress.domain.vo.UploadFileVO;
import com.jcpress.service.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/admin/upload")
@RequiredArgsConstructor
@Tag(name = "后台上传")
public class AdminUploadController {

    private final FileStorageService fileStorageService;

    @PostMapping
    @Operation(summary = "图片上传（jpg/jpeg/png/webp/gif，≤5MB）")
    public Result<UploadFileVO> upload(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        return Result.success(fileStorageService.saveImage(file, StpUtil.getLoginIdAsLong(),
                IpUtils.getClientIp(request), request.getHeader("User-Agent")));
    }
}
