package com.jcpress;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Set;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

/**
 * 架构卡口：把 Agent.md 与规划 §11.4 的规则变成**可执行判据**（CI 违规即失败）。
 *
 * 背景：`docs/decisions.md` #100 自己承认过 ——「Agent.md 里那几条后端规则目前没有任何东西守」。
 * 本期把它们全部落成测试，这里是关闭那条遗留的地方。
 *
 * ⚠️ **包模式必须锚定到 {@code com.jcpress.}**：ArchUnit 的 `..web..` 是"任意层级里出现 web 段"，
 * 它会匹配到 `org.springframework.web` 之类的**框架包**。第一版就因此把
 * 「`GlobalExceptionHandler` 带了 `@RestControllerAdvice`」报成"common 层依赖了业务 web 包"，
 * 一共产出 15 条假违规；同理 `..repository..` 会命中 `org.springframework.data.repository`。
 * 这类错误更危险的形态是**反过来**：规则悄悄命中一堆框架类，看起来在跑，实际什么也没守。
 *
 * 只分析**生产代码**（{@code DoNotIncludeTests}）：规则约束交付物，不是测试脚手架。
 */
@AnalyzeClasses(packages = "com.jcpress", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String ROOT = "com.jcpress.";
    private static final Set<String> VERB_PREFIXES =
            Set.of("get", "list", "count", "save", "insert", "remove", "delete", "update");

    /**
     * 显式放行的**领域动作**动词。
     *
     * Agent.md 那组前缀是给 CRUD 方法定的，而认证是领域动作、没有 CRUD 对应词：
     * `login` 会写 Redis 会话、写审计、更新最近登录信息 —— 硬套成 `getToken` 是误导，
     * `saveLogin` 更不像话。所以这里**显式列白名单**，而不是放宽整条命名规则
     * （放宽会让 `handle()` / `process()` 这类名字也过闸）。
     *
     * 新增条目必须同样在注释里说明"为什么没有 CRUD 对应词"，并同步 docs/decisions.md。
     */
    private static final Set<String> ACTION_PREFIXES =
            Set.of("login", "logout");
    private static final Set<String> OBJECT_METHODS =
            Set.of("equals", "hashCode", "toString", "clone", "finalize", "canEqual");

    // ---------- 分层与可见性（规划 §11.4 依赖方向表） ----------

    @ArchTest
    static final ArchRule portalMustNotDependOnAdmin =
            noClasses().that().resideInAPackage(ROOT + "web.portal..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "web.admin..");

    /** admin 包要到 W3 才有类，现在为空是正常的 —— 空规则不应算失败 */
    @ArchTest
    static final ArchRule adminMustNotDependOnPortal =
            noClasses().that().resideInAPackage(ROOT + "web.admin..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "web.portal..")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule webMustNotTouchRepository =
            noClasses().that().resideInAPackage(ROOT + "web..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "repository..");

    @ArchTest
    static final ArchRule dataObjectsMustNotLeakToWeb =
            noClasses().that().resideInAPackage(ROOT + "web..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "domain.dataobject..");

    @ArchTest
    static final ArchRule controllersMustDependOnServiceInterfacesOnly =
            noClasses().that().resideInAPackage(ROOT + "web..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "service.impl..");

    @ArchTest
    static final ArchRule commonAndInfrastructureMustNotDependOnBusiness =
            noClasses().that().resideInAnyPackage(ROOT + "common..", ROOT + "infrastructure..")
                    .should().dependOnClassesThat()
                    .resideInAnyPackage(ROOT + "domain..", ROOT + "service..",
                            ROOT + "repository..", ROOT + "manager..", ROOT + "web..");

    @ArchTest
    static final ArchRule managerIsOnlyUsedByService =
            noClasses().that().resideInAnyPackage(ROOT + "repository..", ROOT + "web..")
                    .should().dependOnClassesThat().resideInAPackage(ROOT + "manager..");

    // ---------- Agent.md 的编码约定 ----------

    /** 禁字段注入：必须 private final + @RequiredArgsConstructor */
    @ArchTest
    static final ArchRule noFieldAutowiredInjection =
            noFields().should().beAnnotatedWith(Autowired.class);

    /**
     * 同上，另一种常见写法。
     *
     * **故意写成两条独立规则**：`noFields().should().beAnnotatedWith(A).andShould().beAnnotatedWith(B)`
     * 的语义是"同时带两个注解才违规"，只带一个反而被放过 —— 那等于没查。
     */
    @ArchTest
    static final ArchRule noFieldResourceInjection =
            noFields().should().beAnnotatedWith("jakarta.annotation.Resource");

    /** Service/DAO 方法名前缀（get/list/count/save/insert/remove/delete/update） */
    @ArchTest
    static final ArchRule serviceAndRepositoryMethodsUseVerbPrefix =
            methods().that().arePublic().and().areDeclaredInClassesThat()
                    .resideInAnyPackage(ROOT + "service..", ROOT + "repository..")
                    .should(new ArchCondition<>("方法名以动词前缀开头") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            // 静态方法（常量类里的工厂等）与 Object 自带方法不在约束内。
                            // 判断写在条件体里，而不是用 areNotStatic()，避免依赖不确定存在的 API。
                            if (method.getModifiers().contains(JavaModifier.STATIC)) {
                                return;
                            }
                            String name = method.getName();
                            if (OBJECT_METHODS.contains(name)) {
                                return;
                            }
                            boolean ok = VERB_PREFIXES.stream().anyMatch(name::startsWith)
                                    || ACTION_PREFIXES.stream().anyMatch(name::startsWith);
                            if (!ok) {
                                events.add(SimpleConditionEvent.violated(method,
                                        method.getFullName() + " 未以动词前缀开头（Agent.md 命名规约）"));
                            }
                        }
                    });

    /** Service 层禁 QueryWrapper：复杂查询必须走 Mapper 自写 SQL */
    @ArchTest
    static final ArchRule serviceMustNotUseQueryWrapper =
            noClasses().that().resideInAnyPackage(ROOT + "service..", ROOT + "service.impl..")
                    .should().dependOnClassesThat().areAssignableTo(QueryWrapper.class);

    // ---------- HTTP 方法规约（只用 GET/POST） ----------

    @ArchTest
    static final ArchRule onlyGetAndPostMappings =
            noMethods().should().beAnnotatedWith(PutMapping.class)
                    .orShould().beAnnotatedWith(PatchMapping.class)
                    .orShould().beAnnotatedWith(DeleteMapping.class);

    /**
     * 裸 {@code @RequestMapping} 的兜住口 —— **只查方法级**。
     *
     * 类级的 {@code @RequestMapping("/v1/articles")} 只提供路径前缀，是标准写法，必须放过；
     * 方法级的 {@code @RequestMapping} 不带 method 等于对 PUT/DELETE 全开放，必须禁。
     * 这一条**不能用文本正则**做：正则分不清类级与方法级，会把标准写法一起误伤。
     */
    @ArchTest
    static final ArchRule methodLevelRequestMappingMustDeclareMethod =
            methods().that().areAnnotatedWith(RequestMapping.class)
                    .should(new ArchCondition<>("声明 method 属性（否则等于对所有 HTTP 方法开放）") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            RequestMapping mapping = method.getAnnotationOfType(RequestMapping.class);
                            if (mapping.method().length == 0) {
                                events.add(SimpleConditionEvent.violated(method,
                                        method.getFullName() + " 的 @RequestMapping 未声明 method"));
                            }
                        }
                    })
                    .allowEmptyShould(true);
}
