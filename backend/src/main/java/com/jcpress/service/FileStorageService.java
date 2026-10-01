package com.jcpress.service;

import com.jcpress.domain.vo.UploadFileVO;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    /** 保存图片并记一条 UPLOAD 审计（与业务同事务） */
    UploadFileVO saveImage(MultipartFile file, Long adminId, String clientIp, String userAgent);
}
