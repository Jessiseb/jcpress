package com.jcpress.service;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.query.ArticleQuery;
import com.jcpress.domain.vo.ArticleCardVO;
import com.jcpress.domain.vo.ArticleDetailVO;

/**
 * 技术分享的**读路径**（公开、零鉴权）。
 *
 * 只暴露 VO：DO 不出 Service 边界，草稿状态与内部字段也就漏不出去
 * （ArchUnit 的 dataObjectsMustNotLeakToWeb 还兜着 web 层那一半）。
 */
public interface ArticleService {

    PageResult<ArticleCardVO> listPublished(ArticleQuery query);

    ArticleDetailVO getPublishedDetail(String slug);

    /** 浏览量：按 ip + ua 指纹按天去重，幂等 */
    void saveView(String slug, String clientIp, String userAgent);
}
