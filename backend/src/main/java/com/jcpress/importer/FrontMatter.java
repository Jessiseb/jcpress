package com.jcpress.importer;

import lombok.Data;

import java.util.List;

/**
 * Markdown front-matter 的映射（约定见规划 §10.3）。
 *
 * 字段全部用包装类型/可空：**"没给"与"给了空值"必须能区分** —— 校验阶段靠这个判断必填项。
 */
@Data
public class FrontMatter {

    private String title;
    private String slug;
    private String type;
    /** category.slug；TECH / ALGO 必填 */
    private String category;
    private List<String> tags;
    private String summary;
    private String cover;
    /** DRAFT / PUBLISHED / ARCHIVED */
    private String status;
    /** yyyy-MM-dd HH:mm:ss */
    private String publishTime;
}
