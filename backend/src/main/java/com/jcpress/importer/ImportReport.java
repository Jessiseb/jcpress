package com.jcpress.importer;

import java.util.List;

/** 导入结果报告（CLI 输出用） */
public record ImportReport(int created, int updated, int skipped, List<String> failures) {

    public String render() {
        StringBuilder builder = new StringBuilder();
        builder.append("新增 ").append(created).append(" 篇 / 更新 ").append(updated)
                .append(" 篇 / 跳过 ").append(skipped).append(" 篇 / 失败 ")
                .append(failures.size()).append(" 篇");
        for (String failure : failures) {
            builder.append("\n  ✗ ").append(failure);
        }
        return builder.toString();
    }
}
