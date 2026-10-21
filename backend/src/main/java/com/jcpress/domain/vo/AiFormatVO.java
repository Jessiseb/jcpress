package com.jcpress.domain.vo;

import lombok.Data;

import java.util.List;

/**
 * AI 排版的产出：正文 + 三项元信息。
 *
 * 字段全部可空 —— **由前端决定采纳哪些**（用户是"先看对比再应用"）。
 * 服务端只保证：长度与个数落在 ArticleSaveDTO 的校验边界内，超出的部分在这里就被裁掉，
 * 免得"AI 生成的摘要"反过来把保存接口卡在校验上。
 */
@Data
public class AiFormatVO {

    /** 排版后的 Markdown 正文 */
    private String contentMd;

    /** 一句话摘要 */
    private String summary;

    /** 技术标签（名字，不是 id） */
    private List<String> tags;

    /** 英文短名，已按 slug 规则校验；不合规时为 null（前端就别填了） */
    private String slug;
}
