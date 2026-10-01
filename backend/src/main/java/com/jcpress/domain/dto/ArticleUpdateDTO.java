package com.jcpress.domain.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 更新入参 = 新建入参 + id。
 *
 * 这里用继承 + 只加 `@Getter @Setter` 是**有意的**：父类带 `@Data` 会生成 equals/hashCode，
 * 子类若也用 `@Data` 就得补 `@EqualsAndHashCode(callSuper = true)` —— 而那个注解不在
 * Agent.md 的白名单里。只取 getter/setter 就不生成 equals/hashCode，两边都不犯规矩。
 * 校验注解在父类字段上，`@Valid` 会走继承链一并校验。
 *
 * ⚠️ `id` **故意不加 `@NotNull`**：它由 Controller 从路径变量写入 DTO，
 * 而 `@Valid` 在**参数解析阶段**就执行了 —— 那时 id 还是 null，加校验会让更新永远 400。
 * 路径变量本身缺失时 Spring 会先报 400，所以这里不需要再兜。
 */
@Getter
@Setter
public class ArticleUpdateDTO extends ArticleSaveDTO {

    private Long id;
}
