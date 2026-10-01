package com.jcpress.importer;

import com.jcpress.domain.dataobject.ArticleDO;

import java.nio.file.Path;

/**
 * 一个待导入项：解析后的 front-matter + 正文 + 解析好的 categoryId + 库中已有的记录。
 *
 * {@code existing} 为 null 表示"新增"，否则是"更新" —— 幂等的判据就是 (type, slug)。
 */
public record ImportItem(Path file, FrontMatter frontMatter, String body,
                         Long categoryId, ArticleDO existing) {

    public boolean isNew() {
        return existing == null;
    }

    public String action() {
        return isNew() ? "新增" : "更新";
    }
}
