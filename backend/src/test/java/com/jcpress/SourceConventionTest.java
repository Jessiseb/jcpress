package com.jcpress;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 源码级约定扫描：查 ArchUnit **看不到**的两类东西。
 *
 * 1. **Lombok 注解**：它们的保留级是 SOURCE，根本不进字节码，ArchUnit 无从查起。
 * 2. **注解的属性值**：{@code RequestMethod.PUT} 写在属性里，ArchUnit 只看得到注解类型。
 *
 * （「裸 @RequestMapping」不在这里查：正则分不清类级与方法级，会把类级的路径前缀误伤 ——
 * 那条由 {@code ArchitectureTest.methodLevelRequestMappingMustDeclareMethod} 负责。）
 *
 * 只扫生产源码 `src/main/java`。
 */
class SourceConventionTest {

    private static final Path SOURCE_ROOT = Path.of("src/main/java");

    /**
     * Lombok 白名单（Agent.md：仅限 @Data / @Getter / @Setter / @Slf4j）。
     *
     * {@code lombok.RequiredArgsConstructor} 也在白名单里 —— 它不是"额外允许"，
     * 而是 Agent.md 另一条（必须构造器注入、禁 @Autowired 字段注入）**要求**使用的手段。
     */
    private static final Set<String> ALLOWED_LOMBOK_IMPORTS = Set.of(
            "lombok.Data",
            "lombok.Getter",
            "lombok.Setter",
            "lombok.RequiredArgsConstructor",
            "lombok.extern.slf4j.Slf4j");

    /**
     * 逐行匹配 import —— **必须带 {@link Pattern#MULTILINE}**。
     *
     * 少了它，`^` 只匹配整个输入的起始位置（也就是每个文件的第一行），
     * 检查会"全绿"但实际上什么都没扫。这个假绿是被一次**反向验证**抓出来的：
     * 故意塞一个 {@code @Builder} 的类，ArchitectureTest 四条规则全红，这里却依然 3/3 通过。
     */
    private static final Pattern LOMBOK_IMPORT =
            Pattern.compile("^import\\s+lombok\\.([A-Za-z0-9_.]+);", Pattern.MULTILINE);

    private static List<Path> javaFiles() throws IOException {
        try (Stream<Path> stream = Files.walk(SOURCE_ROOT)) {
            return stream.filter(path -> path.toString().endsWith(".java")).toList();
        }
    }

    @Test
    void lombokUsageIsLimitedToWhitelist() throws IOException {
        Map<String, String> violations = new LinkedHashMap<>();

        for (Path file : javaFiles()) {
            String source = Files.readString(file, StandardCharsets.UTF_8);
            Matcher matcher = LOMBOK_IMPORT.matcher(source);
            while (matcher.find()) {
                String imported = "lombok." + matcher.group(1);
                if (!ALLOWED_LOMBOK_IMPORTS.contains(imported)) {
                    violations.put(file.toString(), imported);
                }
            }
        }

        assertThat(violations)
                .as("只允许 @Data/@Getter/@Setter/@Slf4j 与构造器注入用的 @RequiredArgsConstructor")
                .isEmpty();
    }

    @Test
    void noPutPatchDeleteByRequestMethodAttribute() throws IOException {
        for (Path file : javaFiles()) {
            String source = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(source)
                    .as("%s 不得出现 RequestMethod.PUT/PATCH/DELETE", file)
                    .doesNotContain("RequestMethod.PUT")
                    .doesNotContain("RequestMethod.PATCH")
                    .doesNotContain("RequestMethod.DELETE");
        }
    }

    @Test
    void serviceLayerDoesNotReferenceQueryWrapperByText() throws IOException {
        for (Path file : javaFiles()) {
            String normalized = file.toString().replace('\\', '/');
            if (!normalized.contains("/service/")) {
                continue;
            }
            String source = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(source)
                    .as("%s 位于 service 层，不得引用 QueryWrapper（复杂查询走 Mapper 自写 SQL）", file)
                    .doesNotContain("QueryWrapper");
        }
    }
}
