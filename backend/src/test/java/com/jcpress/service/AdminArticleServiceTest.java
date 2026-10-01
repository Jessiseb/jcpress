package com.jcpress.service;

import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * 后台写服务。数据自造自清，不依赖 seed。
 *
 * 覆盖：新建落库（正文 + 标签 + 审计）、slug 冲突、更新重算字数、发布/撤回对 publish_time 的
 * 不同处理、删除不留孤立正文与标签关系。
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminArticleServiceTest {

    private static final Long ADMIN_ID = 1L;
    private static final String IP = "127.0.0.1";
    private static final String UA = "JUnit";

    @Autowired
    AdminArticleService adminArticleService;

    @Autowired
    ArticleMapper articleMapper;

    @Autowired
    ArticleContentMapper articleContentMapper;

    @Autowired
    ArticleTagMapper articleTagMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private final List<Long> createdIds = new ArrayList<>();

    @AfterEach
    void tearDown() {
        // 所有被创建的文章都在 save() 里登记过；删除走 removeArticle 之外的手工清理（测试不该依赖被测方法）
        for (Long id : createdIds) {
            if (articleMapper.selectById(id) != null) {
                articleTagMapper.deleteByArticleId(id);
                articleContentMapper.deleteById(id);
                articleMapper.deleteById(id);
            }
        }
        createdIds.clear();
        jdbcTemplate.update("DELETE FROM admin_audit_log WHERE detail LIKE '%probe%' "
                + "OR detail LIKE '%admin-slug-conflict%'");
        jdbcTemplate.update("DELETE FROM article_tag WHERE tag_id IN "
                + "(SELECT id FROM tag WHERE name IN ('探针标签A', '探针标签B'))");
        jdbcTemplate.update("DELETE FROM tag WHERE name IN ('探针标签A', '探针标签B')");
    }

    private ArticleSaveDTO saveDto(String slug) {
        ArticleSaveDTO dto = new ArticleSaveDTO();
        dto.setTitle("后台写入的测试文章 " + slug);
        dto.setSlug(slug);
        dto.setSummary("摘要");
        dto.setCategoryId(firstTechCategoryId());
        dto.setTags(List.of("探针标签A", "探针标签B"));
        dto.setContentMd("# 标题\n\n把 Redis ZSet 分片写清楚，共 16 个字左右。");
        dto.setStatus(AdminConstant.ARTICLE_STATUS_DRAFT);
        return dto;
    }

    private Long firstTechCategoryId() {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM category WHERE scope = 'TECH' ORDER BY id LIMIT 1", Long.class);
    }

    private Long save(String slug) {
        Long id = adminArticleService.saveArticle(saveDto(slug), ADMIN_ID, IP, UA);
        createdIds.add(id);
        return id;
    }

    @Test
    void savePersistsArticleContentTagsAndAuditLog() {
        Long id = save("admin-save-probe");

        assertThat(articleMapper.selectById(id).getStatus()).isZero();
        assertThat(articleContentMapper.selectById(id).getContentMd()).contains("Redis ZSet");
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(id))).hasSize(2);
        assertThat(articleMapper.selectById(id).getWordCount()).isGreaterThan(0);
        assertThat(articleMapper.selectById(id).getReadingMinutes()).isGreaterThanOrEqualTo(1);

        Integer audits = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE target_id = ? AND action = ?",
                Integer.class, id, AuditActionConstant.CREATE);
        assertThat(audits).isEqualTo(1);
    }

    @Test
    void duplicateSlugIsRejectedWithConflictCode() {
        Long first = save("admin-slug-conflict");

        // 用同一个 slug 再建（不把第二次的 id 加进清理列表：它根本不该被创建）
        BusinessException e = catchThrowableOfType(                () -> adminArticleService.saveArticle(saveDto("admin-slug-conflict"), ADMIN_ID, IP, UA), BusinessException.class);

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.SLUG_CONFLICT.getCode());
        assertThat(first).isNotNull();
    }

    @Test
    void blankSlugWithChineseTitleIsRejectedWithHintInsteadOfGuessingPinyin() {
        ArticleSaveDTO dto = saveDto(null);
        dto.setTitle("三期后端复盘");
        dto.setSlug(null);

        BusinessException e = catchThrowableOfType(                () -> adminArticleService.saveArticle(dto, ADMIN_ID, IP, UA), BusinessException.class);

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.PARAM_ERROR.getCode());
        assertThat(e.getMessage()).contains("请手动填写");
    }

    @Test
    void updateRecalculatesWordCountAndRebuildsTags() {
        Long id = save("admin-update-probe");
        int before = articleMapper.selectById(id).getWordCount();

        ArticleUpdateDTO update = new ArticleUpdateDTO();
        update.setId(id);
        update.setTitle("改过的标题");
        update.setSlug("admin-update-probe");
        update.setCategoryId(firstTechCategoryId());
        update.setTags(List.of("探针标签A"));
        update.setContentMd("短了。");
        adminArticleService.updateArticle(update, ADMIN_ID, IP, UA);

        assertThat(articleMapper.selectById(id).getWordCount()).isLessThan(before);
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(id))).hasSize(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE target_id = ? AND action = ?",
                Integer.class, id, AuditActionConstant.UPDATE)).isEqualTo(1);
    }

    @Test
    void publishSetsPublishTimeAndUnpublishKeepsIt() {
        Long id = save("admin-publish-probe");

        adminArticleService.updateStatus(id, AdminConstant.ARTICLE_STATUS_PUBLISHED, ADMIN_ID, IP, UA);
        var published = articleMapper.selectById(id);
        assertThat(published.getStatus()).isEqualTo(AdminConstant.ARTICLE_STATUS_PUBLISHED);
        assertThat(published.getPublishTime()).isNotNull();
        var publishTime = published.getPublishTime();

        adminArticleService.updateStatus(id, AdminConstant.ARTICLE_STATUS_DRAFT, ADMIN_ID, IP, UA);
        var unpublished = articleMapper.selectById(id);
        assertThat(unpublished.getStatus()).isZero();
        assertThat(unpublished.getPublishTime()).isEqualTo(publishTime);
    }

    @Test
    void invalidStatusIsRejected() {
        Long id = save("admin-publish-probe");

        BusinessException e = catchThrowableOfType(                () -> adminArticleService.updateStatus(id, 9, ADMIN_ID, IP, UA), BusinessException.class);

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.PARAM_ERROR.getCode());
    }

    @Test
    void removeDeletesContentAndTagRelations() {
        Long id = save("admin-remove-probe");

        adminArticleService.removeArticle(id, ADMIN_ID, IP, UA);

        assertThat(articleMapper.selectById(id)).isNull();
        assertThat(articleContentMapper.selectById(id)).isNull();
        assertThat(articleTagMapper.listTagRefsByArticleIds(List.of(id))).isEmpty();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_audit_log WHERE target_id = ? AND action = ?",
                Integer.class, id, AuditActionConstant.DELETE)).isEqualTo(1);
    }

    @Test
    void missingArticleIsReportedAsNotFound() {
        assertThatThrownBy(() -> adminArticleService.removeArticle(999999L, ADMIN_ID, IP, UA))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("code", ErrorCodeEnum.ARTICLE_NOT_FOUND.getCode());
    }
}
