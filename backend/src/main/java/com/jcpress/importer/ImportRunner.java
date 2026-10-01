package com.jcpress.importer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.List;

/**
 * 导入器的 CLI 入口（**不暴露任何 HTTP 端点**）。
 *
 * 只有带 `--import=<dir>` 才干活，其余情况静默退出 —— 所以它挂在正常的应用启动流程里也不会
 * 影响 Web 应用。配合 `application-importer.yml` 的 `web-application-type: none`，
 * 以 CLI 方式跑时不会起 Tomcat。
 *
 * **干完活显式退出**：这是 CLI 进程，不是服务。即使将来又冒出一个非守护线程，
 * 也不会像第一次那样挂住十几分钟（那次是调度线程池，已由 `SchedulingConfig` 的 profile 条件挡掉）。
 *
 * 用法：
 * ```
 * java -jar jcpress-backend.jar --spring.profiles.active=importer --import=../content/tech --dry-run
 * java -jar jcpress-backend.jar --spring.profiles.active=importer --import=../content/tech
 * ```
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ImportRunner implements ApplicationRunner {

    public static final String ARG_IMPORT = "import";
    public static final String ARG_DRY_RUN = "dry-run";

    private final MarkdownImporter markdownImporter;
    private final ApplicationContext applicationContext;

    @Override
    public void run(ApplicationArguments args) {
        if (!args.containsOption(ARG_IMPORT)) {
            // 不是导入模式：什么都不做，让 Web 应用照常跑
            return;
        }

        List<String> values = args.getOptionValues(ARG_IMPORT);
        if (values == null || values.isEmpty()) {
            throw new ImportException("--import 需要给定目录");
        }
        Path directory = Path.of(values.get(0));

        try {
            // 第一段：只读校验。dry-run 到这里就够了 —— 它连事务都没进
            List<ImportItem> items = markdownImporter.prepare(directory);

            if (args.containsOption(ARG_DRY_RUN)) {
                System.out.println("[dry-run] 将处理 " + items.size() + " 个文件：");
                items.forEach(item -> System.out.printf("  %s  %s  (%s)%n",
                        item.action(), item.frontMatter().getSlug(), item.file().getFileName()));
                System.out.println("[dry-run] 未写库。");
            } else {
                System.out.println(markdownImporter.importItems(items).render());
            }
        } catch (ImportException e) {
            // 输入问题：打印可读原因并以非 0 退出（CI 与手工都靠退出码判断）
            System.err.println("导入失败：" + e.getMessage());
            System.exit(SpringApplication.exit(applicationContext, () -> 2));
        } catch (Exception e) {
            System.err.println("导入失败：" + e.getMessage());
            log.error("导入异常", e);
            System.exit(SpringApplication.exit(applicationContext, () -> 1));
        }

        System.exit(SpringApplication.exit(applicationContext, () -> 0));
    }
}
