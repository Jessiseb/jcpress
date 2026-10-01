package com.jcpress.infrastructure.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * 文件存储抽象。
 *
 * 本期只有本地磁盘实现（无对象存储、无 CDN）；将来换 OSS/COS 只需加一个实现类，
 * Service 与 Controller 不动。
 */
public interface FileStorage {

    StoredFile save(MultipartFile file);
}
