package com.jcpress.service;

import com.jcpress.common.result.PageResult;
import com.jcpress.domain.dto.ArticleSaveDTO;
import com.jcpress.domain.dto.ArticleUpdateDTO;
import com.jcpress.domain.query.AdminArticleQuery;
import com.jcpress.domain.vo.AdminArticleVO;

/**
 * 后台文章写平面。
 *
 * 命名说明：发布/撤回是 `updateStatus`（状态迁移用 update 前缀），
 * **不叫 `publishArticle`** —— 后者过不了命名卡口，而且"改状态"确实就是它的语义。
 */
public interface AdminArticleService {

    PageResult<AdminArticleVO> listForAdmin(AdminArticleQuery query);

    AdminArticleVO getForAdmin(Long id);

    Long saveArticle(ArticleSaveDTO dto, Long adminId, String clientIp, String userAgent);

    void updateArticle(ArticleUpdateDTO dto, Long adminId, String clientIp, String userAgent);

    /** status: 1 发布（publishTime 为空时写入当前时间），0 撤回（不动 publishTime），2 归档 */
    void updateStatus(Long id, Integer status, Long adminId, String clientIp, String userAgent);

    void removeArticle(Long id, Long adminId, String clientIp, String userAgent);
}
