package com.jcpress.domain.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * 更新入参 = 新建入参 + id。
 *
 * 这里用继承 + 只加 `@Getter @Setter` 是**有意的**：父类带 `@Data` 会生成 equals/hashCode，
 * 子类若也用 `@Data` 就得补 `@EqualsAndHashCode(callSuper = true)` —— 而那个注解不在
 * Agent.md 的白名单里。只取 getter/setter 就不生成 equals/hashCode，两边都不犯规矩。
 * 校验注解在父类字段上，`@Valid` 会走继承链一并校验。
 */
@Getter
@Setter
public class ArticleUpdateDTO extends ArticleSaveDTO {

    @NotNull(message = "缺少文章 id")
    private Long id;
}
