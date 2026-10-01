package com.jcpress.infrastructure.storage;

import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 本地磁盘存储。
 *
 * 安全清单（规划 §10.5，逐条都在下面的代码里）：
 * ① 扩展名白名单；② 校验文件头 magic bytes（扩展名可以伪造）；③ 大小上限；
 * ④ 重命名落盘（不沿用原始文件名）；⑤ 拒绝含路径分隔符或 `..` 的文件名；
 * ⑥ 规范化后必须仍落在根目录内（路径穿越的最后一道闸）。
 *
 * ⚠️ **两个前缀不能是同一个值**：
 * - `resourcePath`（`/uploads`）是 `addResourceHandlers` 注册用的、**相对 context-path** 的路径；
 * - `publicPrefix`（`/api/uploads`）是写进 Markdown 与数据库、**对外可访问**的 URL 前缀。
 *
 * 因为后端 `context-path=/api`，文件实际服务在 `/api/uploads/...`。混用会让正文里的图片地址
 * 直接 404 —— 而这只有在肉眼看图时才会发现。
 */
@Component
@Slf4j
public class LocalFileStorage implements FileStorage {

    private static final DateTimeFormatter DATE_DIR = DateTimeFormatter.ofPattern("yyyy/MM");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G'};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] GIF_MAGIC = {'G', 'I', 'F', '8'};
    private static final byte[] RIFF_MAGIC = {'R', 'I', 'F', 'F'};

    private final Path rootDir;
    private final String publicPrefix;
    private final long maxBytes;

    public LocalFileStorage(@Value("${jcpress.upload.dir:./uploads}") String dir,
                            @Value("${jcpress.upload.public-prefix:/api/uploads}") String publicPrefix,
                            @Value("${jcpress.upload.max-bytes:5242880}") long maxBytes) {
        this.rootDir = Path.of(dir).toAbsolutePath().normalize();
        this.publicPrefix = publicPrefix;
        this.maxBytes = maxBytes;
        // 目录在构造期建好：① 单测直接 new 就能用，不依赖容器生命周期；
        //                   ② 启动即失败，而不是等到第一次上传才失败
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建上传目录 " + this.rootDir, e);
        }
        log.info("本地上传目录就绪 dir={} publicPrefix={} maxBytes={}", this.rootDir, publicPrefix, maxBytes);
    }

    @Override
    public StoredFile save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件为空");
        }
        if (file.getSize() > maxBytes) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件超过大小上限");
        }

        String extension = resolveExtension(file.getOriginalFilename());
        try (InputStream in = file.getInputStream()) {
            if (!matchesMagicBytes(in, extension)) {
                throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "文件内容与扩展名不符");
            }
        } catch (IOException e) {
            log.error("读取上传文件失败 name={}", file.getOriginalFilename(), e);
            throw new BusinessException(ErrorCodeEnum.OPERATION_ERROR, "读取上传文件失败");
        }

        String relativeDir = LocalDate.now().format(DATE_DIR);
        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = rootDir.resolve(relativeDir).resolve(filename).normalize();
        if (!target.startsWith(rootDir)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "非法的上传路径");
        }

        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target.toFile());
        } catch (IOException e) {
            log.error("写入上传文件失败 target={}", target, e);
            throw new BusinessException(ErrorCodeEnum.OPERATION_ERROR, "保存文件失败");
        }
        return new StoredFile(publicPrefix + "/" + relativeDir + "/" + filename,
                target.toString(), file.getSize());
    }

    /** 只认扩展名，同时就把"非法文件名"挡掉；真正的内容判断在 magic bytes */
    private String resolveExtension(String originalFilename) {
        if (originalFilename == null) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "缺少文件名");
        }
        String name = originalFilename.toLowerCase(Locale.ROOT);
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "非法文件名");
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "缺少扩展名");
        }
        String extension = name.substring(dot + 1);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "不支持的文件类型");
        }
        return "jpeg".equals(extension) ? "jpg" : extension;
    }

    private boolean matchesMagicBytes(InputStream in, String extension) throws IOException {
        byte[] head = in.readNBytes(12);
        return switch (extension) {
            case "png" -> startsWith(head, PNG_MAGIC);
            case "jpg" -> startsWith(head, JPEG_MAGIC);
            case "gif" -> startsWith(head, GIF_MAGIC);
            case "webp" -> startsWith(head, RIFF_MAGIC) && head.length >= 12
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
            default -> false;
        };
    }

    private boolean startsWith(byte[] head, byte[] prefix) {
        if (head.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (head[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
