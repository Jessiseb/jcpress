package com.jcpress.service;

import com.jcpress.domain.dto.AiFormatDTO;
import com.jcpress.domain.vo.AiFormatVO;

/**
 * AI 排版：把正文整理成规范 Markdown，并抽取摘要 / 标签 / slug。
 *
 * 定位是**后台写入口的辅助能力**，不是内容生成 —— prompt 里明确要求"不新增、不删除、
 * 不曲解任何技术事实"。用户侧始终是"先看对比再应用"，所以这里返回内容而不直接落库。
 */
public interface AiFormatService {

    /**
     * @param adminId 当前登录管理员，用于审计
     * @return 排版结果；调用方（前端）自行决定采纳哪些字段
     */
    AiFormatVO formatArticle(AiFormatDTO dto, Long adminId, String clientIp, String userAgent);
}
