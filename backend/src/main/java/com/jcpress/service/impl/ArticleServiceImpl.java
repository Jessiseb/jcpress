package com.jcpress.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.result.PageResult;
import com.jcpress.domain.converter.ArticleConverter;
import com.jcpress.domain.dataobject.ArticleContentDO;
import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.domain.projection.ArticleTagRef;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.manager.ArticleViewManager;
import com.jcpress.repository.ArticleContentMapper;
import com.jcpress.repository.ArticleMapper;
import com.jcpress.repository.ArticleTagMapper;
import com.jcpress.service.ArticleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleServiceImpl implements ArticleService {

    private final ArticleMapper articleMapper;
    private final ArticleContentMapper articleContentMapper;
    private final ArticleTagMapper articleTagMapper;
    private final ArticleViewManager articleViewManager;

    @Override
    public PageResult<ArticleCardVO> listPublished(ArticleQuery query) {
        Page<ArticleDO> page = new Page<>(query.normalizedPage(), query.normalizedSize());
        Page<ArticleDO> result = articleMapper.listPublished(page, query);

        // 一次批量取标签再在内存分组（避免 N+1）；空集合必须提前挡掉，IN () 是语法错
        List<Long> articleIds = result.getRecords().stream().map(ArticleDO::getId).toList();
        Map<Long, List<TagVO>> tagsByArticle = articleIds.isEmpty()
                ? Map.of()
                : ArticleConverter.groupTags(articleTagMapper.listTagRefsByArticleIds(articleIds));

        List<ArticleCardVO> cards = result.getRecords().stream()
                .map(article -> {
                    ArticleCardVO card = ArticleConverter.toCardVO(article);
                    card.setTags(tagsByArticle.getOrDefault(article.getId(), List.of()));
                    return card;
                })
                .toList();

        return PageResult.of(cards, result.getCurrent(), result.getSize(), result.getTotal());
    }

    @Override
    public ArticleDetailVO getPublishedDetail(String slug) {
        ArticleDO article = articleMapper.getPublishedBySlug(defaultType(), slug);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }

        ArticleContentDO content = articleContentMapper.selectById(article.getId());
        List<TagVO> tags = ArticleConverter.filterTagsOf(
                articleTagMapper.listTagRefsByArticleIds(List.of(article.getId())), article.getId());

        // 相邻篇内联进详情：前端一次请求即可渲染完（规划 §9.2 的 /adjacent 接口本期不实现）
        ArticleDO prev = articleMapper.getAdjacentPrev(article.getType(), article.getPublishTime());
        ArticleDO next = articleMapper.getAdjacentNext(article.getType(), article.getPublishTime());

        return ArticleConverter.toDetailVO(article, content, tags, prev, next);
    }

    @Override
    public void saveView(String slug, String clientIp, String userAgent) {
        ArticleDO article = articleMapper.getPublishedBySlug(defaultType(), slug);
        if (article == null) {
            throw new BusinessException(ErrorCodeEnum.ARTICLE_NOT_FOUND);
        }
        articleViewManager.saveView(article.getId(), clientIp, userAgent);
    }

    private String defaultType() {
        return "TECH";
    }
}
