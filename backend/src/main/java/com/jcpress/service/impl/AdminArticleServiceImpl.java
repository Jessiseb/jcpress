package com.jcpress.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.result.PageResult;
import com.jcpress.common.util.SlugUtils;
import com.jcpress.common.util.WordCountUtils;
import com.jcpress.domain.converter.ArticleConverter;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.dataobject.ArticleTagDO;
import com.jcpress.domain.dataobject.TagDO;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import com.jcpress.repository.TagMapper;
import com.jcpress.service.AdminArticleService;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminArticleServiceImpl implements AdminArticleService {

    private static final DateTimeFormatter SLUG_SUFFIX = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    /** 允许的状态值：草稿 / 已发布 / 归档 */
    private static final List<Integer> ALLOWED_STATUS = List.of(0, 1, 2);

    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final ArticleTagMapper articleTagMapper;
    private final TagMapper tagMapper;
    private final AuditLogService auditLogService;

    @Override
    public PageResult<AdminArticleVO> listForAdmin(AdminArticleQuery query) {
        Page<ArticleDO> page = new Page<>(query.normalizedPage(), query.normalizedSize());
        Page<ArticleDO> result = articleMapper.listForAdmin(page, query);

        List<Long> articleIds = result.getRecords().stream().map(ArticleDO::getId).toList();
        Map<Long, List<TagVO>> tagsByArticle = articleIds.isEmpty()
                ? Map.of()
                : ArticleConverter.groupTags(articleTagMapper.listTagRefsByArticleIds(articleIds));

        List<AdminArticleVO> list = result.getRecords().stream()
                .map(article -> toAdminVO(article,
                        tagsByArticle.getOrDefault(article.getId(), List.of()), null))
                .toList();
        return PageResult.of(list, result.getCurrent(), result.getSize(), result.getTotal());
    }

    @Override
    public AdminArticleVO getForAdmin(Long id) {
        ArticleDO article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        ArticleContentDO content = articleContentMapper.selectById(id);
        List<TagVO> tags = ArticleConverter.filterTagsOf(
                articleTagMapper.listTagRefsByArticleIds(List.of(id)), id);
        return toAdminVO(article, tags, content == null ? "" : content.getContentMd());
    }

    @Override
    @Transactional
    public Long saveArticle(ArticleSaveDTO dto, Long adminId, String clientIp, String userAgent) {
        String slug = resolveSlug(dto.getSlug(), dto.getTitle());
        if (articleMapper.getByTypeAndSlug(AdminConstant.TYPE_TECH, slug) != null) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleDO article = new ArticleDO();
        applyEditableFields(article, dto);
        article.setType(AdminConstant.TYPE_TECH);
        article.setSlug(slug);
        article.setStatus(normalizeStatus(dto.getStatus()));
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        if (article.getStatus() == AdminConstant.ARTICLE_STATUS_PUBLISHED) {
            article.setPublishTime(LocalDateTime.now());
        }

        try {
            articleMapper.insert(article);
        } catch (DuplicateKeyException e) {
            // uk_type_slug 才是权威判据：预检只是为了让用户早点看到 40901，并发下仍可能撞上
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(article.getId());
        content.setContentMd(dto.getContentMd());
        articleContentMapper.insert(content);

        updateTags(article.getId(), dto.getTags());
        saveAudit(adminId, AuditActionConstant.CREATE, article.getId(), "新建文章 " + slug,
                clientIp, userAgent);
        return article.getId();
    }

    @Override
    @Transactional
    public void updateArticle(ArticleUpdateDTO dto, Long adminId, String clientIp, String userAgent) {
        ArticleDO existing = articleMapper.selectById(dto.getId());
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        String slug = resolveSlug(dto.getSlug(), dto.getTitle());
        ArticleDO sameSlug = articleMapper.getByTypeAndSlug(AdminConstant.TYPE_TECH, slug);
        if (sameSlug != null && !sameSlug.getId().equals(dto.getId())) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleDO article = new ArticleDO();
        article.setId(dto.getId());
        applyEditableFields(article, dto);
        article.setSlug(slug);
        try {
            articleMapper.updateById(article);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ErrorCodeEnum.SLUG_CONFLICT);
        }

        ArticleContentDO content = new ArticleContentDO();
        content.setArticleId(dto.getId());
        content.setContentMd(dto.getContentMd());
        if (articleContentMapper.selectById(dto.getId()) == null) {
            articleContentMapper.insert(content);
        } else {
            articleContentMapper.updateById(content);
        }

        updateTags(dto.getId(), dto.getTags());
        saveAudit(adminId, AuditActionConstant.UPDATE, dto.getId(), "更新文章 " + slug,
                clientIp, userAgent);
    }

    @Override
    @Transactional
    public void updateStatus(Long id, Integer status, Long adminId, String clientIp, String userAgent) {
        ArticleDO existing = articleMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        if (status == null || !ALLOWED_STATUS.contains(status)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR, "status 只允许 0/1/2");
        }

        ArticleDO article = new ArticleDO();
        article.setId(id);
        article.setStatus(status);
        // 发布且从未发布过 → 写入发布时间；撤回**不动** publishTime（再发布时时间不会漂）
        if (status == AdminConstant.ARTICLE_STATUS_PUBLISHED && existing.getPublishTime() == null) {
            article.setPublishTime(LocalDateTime.now());
        }
        articleMapper.updateById(article);
        saveAudit(adminId, AuditActionConstant.PUBLISH, id,
                "状态 " + existing.getStatus() + " → " + status, clientIp, userAgent);
    }

    @Override
    @Transactional
    public void removeArticle(Long id, Long adminId, String clientIp, String userAgent) {
        ArticleDO existing = articleMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        // 逻辑外键在应用层解决（规划 §6.6）：先删从表再删主表，不留孤立记录
        articleTagMapper.deleteByArticleId(id);
        articleContentMapper.deleteById(id);
        articleMapper.deleteById(id);
        saveAudit(adminId, AuditActionConstant.DELETE, id, "删除文章 " + existing.getSlug(),
                clientIp, userAgent);
        log.info("文章已删除 id={} slug={} by adminId={}", id, existing.getSlug(), adminId);
    }

    private void applyEditableFields(ArticleDO article, ArticleSaveDTO dto) {
        int wordCount = WordCountUtils.count(dto.getContentMd());
        article.setTitle(dto.getTitle());
        article.setSummary(dto.getSummary());
        article.setCoverUrl(dto.getCoverUrl());
        article.setCategoryId(dto.getCategoryId());
        article.setWordCount(wordCount);
        article.setReadingMinutes(WordCountUtils.estimateReadingMinutes(wordCount));
    }

    /** 状态只接受 0/1（更新时不允许直接改成归档，避免绕过发布流程） */
    private int normalizeStatus(Integer status) {
        return status == null ? AdminConstant.ARTICLE_STATUS_DRAFT : status;
    }

    private String resolveSlug(String rawSlug, String title) {
        String slug = (rawSlug == null || rawSlug.isBlank()) ? SlugUtils.normalize(title) : rawSlug.trim();
        if (slug == null) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR,
                    "标题无法自动生成 slug（纯中文标题不猜拼音），请手动填写");
        }
        if (!SlugUtils.isValid(slug)) {
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR,
                    "slug 只能是小写字母/数字/连字符，长度 3–120");
        }
        return slug;
    }

    /** 标签按**名字**进出：解析已有标签或创建新标签，然后整体重建该文章的关系 */
    private void updateTags(Long articleId, List<String> tagNames) {
        articleTagMapper.deleteByArticleId(articleId);
        if (tagNames == null || tagNames.isEmpty()) {
            return;
        }
        tagNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .limit(AdminConstant.MAX_TAGS_PER_ARTICLE)
                .forEach(name -> {
                    String slug = SlugUtils.normalize(name);
                    if (slug == null) {
                        // 纯中文标签名也要能建：用名字做 slug 的兜底（唯一索引在 slug 上）
                        slug = "tag-" + Math.abs(name.hashCode());
                    }
                    TagDO tag = tagMapper.getBySlug(slug);
                    if (tag == null) {
                        tag = new TagDO();
                        tag.setName(name.trim());
                        tag.setSlug(slug);
                        try {
                            tagMapper.insert(tag);
                        } catch (DuplicateKeyException e) {
                            tag = tagMapper.getBySlug(slug);   // 并发下别人刚插进去
                        }
                    }
                    ArticleTagDO relation = new ArticleTagDO();
                    relation.setArticleId(articleId);
                    relation.setTagId(tag.getId());
                    articleTagMapper.insert(relation);
                });
    }

    private AdminArticleVO toAdminVO(ArticleDO article, List<TagVO> tags, String contentMd) {
        AdminArticleVO vo = new AdminArticleVO();
        vo.setId(article.getId());
        vo.setTitle(article.getTitle());
        vo.setSlug(article.getSlug());
        vo.setSummary(article.getSummary());
        vo.setCoverUrl(article.getCoverUrl());
        vo.setCategoryId(article.getCategoryId());
        vo.setCategoryName(article.getCategoryName());
        vo.setTags(tags.stream().map(TagVO::getName).toList());
        vo.setStatus(article.getStatus());
        vo.setWordCount(article.getWordCount());
        vo.setReadingMinutes(article.getReadingMinutes());
        vo.setViewCount(article.getViewCount());
        vo.setTop(article.getTop());
        vo.setPublishTime(article.getPublishTime());
        vo.setGmtModified(article.getGmtModified());
        vo.setContentMd(contentMd);
        return vo;
    }

    private void saveAudit(Long adminId, String action, Long targetId, String detail,
                           String clientIp, String userAgent) {
        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(action);
        audit.setTargetType(AdminConstant.TARGET_TYPE_ARTICLE);
        audit.setTargetId(targetId);
        audit.setDetail(detail);
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);
    }
}
