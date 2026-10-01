package com.jcpress.service.impl;

import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.vo.UploadFileVO;
import com.jcpress.infrastructure.storage.FileStorage;
import com.jcpress.infrastructure.storage.StoredFile;
import com.jcpress.service.AuditLogService;
import com.jcpress.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FileStorageServiceImpl implements FileStorageService {

    private final FileStorage fileStorage;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public UploadFileVO saveImage(MultipartFile file, Long adminId, String clientIp, String userAgent) {
        StoredFile stored = fileStorage.save(file);

        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(AuditActionConstant.UPLOAD);
        audit.setDetail("上传图片 " + stored.getUrl());
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);

        UploadFileVO vo = new UploadFileVO();
        vo.setUrl(stored.getUrl());
        vo.setSize((int) stored.getSize());
        return vo;
    }
}
