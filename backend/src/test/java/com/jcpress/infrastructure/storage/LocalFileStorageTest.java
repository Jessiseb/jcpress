package com.jcpress.infrastructure.storage;

import com.jcpress.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 上传的安全约束逐条验证。
 *
 * 注意「超限」那条：上限必须真的小于文件大小才有效 —— 用 1MB 的上限配 2KB 的文件
 * 是测不到那条分支的（这是初稿计划里的一处假绿）。
 */
class LocalFileStorageTest {

    private static final byte[] REAL_PNG = {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13};

    @TempDir
    Path tempDir;

    private LocalFileStorage storage(long maxBytes) {
        return new LocalFileStorage(tempDir.toString(), "/api/uploads", maxBytes);
    }

    private LocalFileStorage storage() {
        return storage(1024L * 1024L);
    }

    @Test
    void realPngIsStoredUnderDateDirectoryWithRandomName() {
        StoredFile stored = storage().save(
                new MockMultipartFile("file", "shot.PNG", "image/png", REAL_PNG));

        // URL 必须含 context-path（/api/uploads），否则写进正文就是 404
        assertThat(stored.getUrl()).matches("/api/uploads/\\d{4}/\\d{2}/[0-9a-f]{32}\\.png");
        assertThat(Files.exists(Path.of(stored.getAbsolutePath()))).isTrue();
        // 落盘位置在（临时）根目录之内
        assertThat(Path.of(stored.getAbsolutePath()).startsWith(tempDir.toAbsolutePath().normalize())).isTrue();
    }

    @Test
    void extensionThatLiesAboutContentIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "evil.png", "image/png",
                "<?php system($_GET['c']); ?>".getBytes());

        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件内容与扩展名不符");
    }

    @Test
    void disallowedExtensionIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "run.jsp", "image/png", REAL_PNG);

        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("不支持的文件类型");
    }

    @Test
    void pathTraversalInFilenameIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "../config/app.png", "image/png", REAL_PNG);

        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("非法文件名");
    }

    @Test
    void oversizedFileIsRejected() {
        byte[] big = new byte[2048];
        System.arraycopy(REAL_PNG, 0, big, 0, REAL_PNG.length);
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", big);

        assertThatThrownBy(() -> storage(1024L).save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件超过大小上限");
    }

    @Test
    void emptyFileIsRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> storage().save(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件为空");
    }

    @Test
    void jpegExtensionIsNormalizedToJpg() {
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1};
        StoredFile stored = storage().save(
                new MockMultipartFile("file", "photo.jpeg", "image/jpeg", jpeg));

        assertThat(stored.getUrl()).endsWith(".jpg");
    }
}
