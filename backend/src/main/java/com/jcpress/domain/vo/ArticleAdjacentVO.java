package com.jcpress.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

/** 相邻篇（上下篇）的极简 VO：只够渲染一张导航卡 */
@Data
public class ArticleAdjacentVO {

    private String title;
    private String slug;
    private LocalDateTime publishTime;
}
