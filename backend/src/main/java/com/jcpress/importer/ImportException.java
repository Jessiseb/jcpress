package com.jcpress.importer;

/**
 * 导入期的输入问题：**整批回滚，不写库**。
 *
 * 与 {@code BusinessException} 分开：那个是接口层的业务错误（要映射成 HTTP 状态码），
 * 这个是 CLI 的输入错误（要带着文件名打到终端上）。
 */
public class ImportException extends RuntimeException {

    public ImportException(String message) {
        super(message);
    }
}
