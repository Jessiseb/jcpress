package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 文章-标签关系。多对多关系表，按规划 §6.6 **有意不设** id/gmt_* 三字段。
 */
@Data
@TableName("article_tag")
public class ArticleTagDO {

    private Long articleId;
    private Long tagId;
}
