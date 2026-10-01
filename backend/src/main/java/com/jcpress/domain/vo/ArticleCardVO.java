package com.jcpress.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 公开列表的卡片 VO。
 *
 * **故意没有 status / gmtModified / wordCount**：草稿状态与内部字段不该从公开接口漏出去
 * （规划 §11.4 的 portal 出参约定）。同样**没有 contentMd** —— 列表绝不带正文。
 * 这几条在 `ArticleConverterTest` 里有断言兜着。
 */
@Data
public class ArticleCardVO {

    private Long id;
    private String title;
    private String slug;
    private String summary;
    private String coverUrl;
    private String categoryName;
    private String categorySlug;
    private List<TagVO> tags;
    private Integer readingMinutes;
    private Integer viewCount;
    private Integer top;
    private LocalDateTime publishTime;
}
