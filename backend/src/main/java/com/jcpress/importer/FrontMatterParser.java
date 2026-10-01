package com.jcpress.importer;

import com.jcpress.common.util.SlugUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.util.List;
import java.util.Map;

/**
 * front-matter 解析与校验。
 *
 * 用 Spring Boot 自带的 SnakeYAML（`spring-boot-starter` 为了解析 yml 已经带上它），
 * **不新增依赖**。
 *
 * 校验失败一律抛 {@link ImportException} 且带上**文件名** —— 导入目录里可能有几十个文件，
 * 只说"title 必填"等于让人自己去猜是哪一个。
 */
@Component
@Slf4j
public class FrontMatterParser {

    private static final String DELIMITER = "---";
    private static final List<String> ALLOWED_STATUS = List.of("DRAFT", "PUBLISHED", "ARCHIVED");
    private static final List<String> ALLOWED_TYPES = List.of("TECH", "ALGO", "PROJECT");

    public ParsedMarkdown parse(String raw, String fileName) {
        String normalized = raw.replace("\r\n", "\n");
        if (!normalized.startsWith(DELIMITER)) {
            throw new ImportException(fileName + "：缺少 front-matter（文件必须以 --- 开头）");
        }
        int end = normalized.indexOf("\n" + DELIMITER, DELIMITER.length());
        if (end < 0) {
            throw new ImportException(fileName + "：front-matter 没有结束的 ---");
        }

        String yamlBlock = normalized.substring(DELIMITER.length(), end);
        String body = normalized.substring(end + DELIMITER.length() + 1).stripLeading();

        Map<String, Object> map;
        try {
            map = new Yaml().load(yamlBlock);
        } catch (RuntimeException e) {
            throw new ImportException(fileName + "：front-matter 不是合法 YAML（" + e.getMessage() + "）");
        }
        if (map == null) {
            throw new ImportException(fileName + "：front-matter 为空");
        }

        FrontMatter frontMatter = new FrontMatter();
        frontMatter.setTitle(asString(map.get("title")));
        frontMatter.setSlug(asString(map.get("slug")));
        frontMatter.setType(map.get("type") == null ? "TECH" : asString(map.get("type")));
        frontMatter.setCategory(asString(map.get("category")));
        frontMatter.setSummary(asString(map.get("summary")));
        frontMatter.setCover(asString(map.get("cover")));
        frontMatter.setStatus(map.get("status") == null ? "DRAFT" : asString(map.get("status")));
        frontMatter.setPublishTime(asString(map.get("publishTime")));
        if (map.get("tags") instanceof List<?> tags) {
            frontMatter.setTags(tags.stream().map(String::valueOf).toList());
        }

        validate(frontMatter, fileName);
        return new ParsedMarkdown(frontMatter, body);
    }

    private void validate(FrontMatter frontMatter, String fileName) {
        if (isBlank(frontMatter.getTitle())) {
            throw new ImportException(fileName + "：title 必填");
        }
        if (!SlugUtils.isValid(frontMatter.getSlug())) {
            throw new ImportException(fileName
                    + "：slug 缺失或格式不合法（小写字母/数字/连字符，长度 3–120）");
        }
        if (!ALLOWED_TYPES.contains(frontMatter.getType())) {
            throw new ImportException(fileName + "：type 只允许 TECH/ALGO/PROJECT");
        }
        if (isBlank(frontMatter.getCategory())) {
            throw new ImportException(fileName + "：category 必填（填 category.slug）");
        }
        if (!ALLOWED_STATUS.contains(frontMatter.getStatus())) {
            throw new ImportException(fileName + "：status 只允许 DRAFT/PUBLISHED/ARCHIVED");
        }
        if (isBlank(frontMatter.getSummary())) {
            throw new ImportException(fileName + "：summary 必填（列表页与卡片要用）");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    /** 解析结果：front-matter + 正文 */
    public record ParsedMarkdown(FrontMatter frontMatter, String body) {
    }
}
