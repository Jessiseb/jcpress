package com.jcpress.domain.query;

import lombok.Getter;
import lombok.Setter;

/**
 * 公开列表入参。
 *
 * **故意不用 {@code @Data}**：它除了 getter/setter 还会生成 equals/hashCode，
 * 而子类要消掉 Lombok 的「未调用父类 equals」告警就得加 {@code @EqualsAndHashCode(callSuper = true)} ——
 * 那个注解不在 Agent.md 的白名单里（只允许 @Data/@Getter/@Setter/@Slf4j）。
 * 查询对象只需要读写，取 {@code @Getter @Setter} 即可，两边都干净。
 *
 * **故意不含 keyword**：公开列表本期不做搜索（见 openspec design / proposal）。
 */
@Getter
@Setter
public class ArticleQuery extends PageQuery {

    private String type = "TECH";
    private Long categoryId;
    private String tagSlug;
}
