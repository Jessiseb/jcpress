package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.ArticleContentDO;

/**
 * 正文 DAO。只需要主键读写，继承方法就够 —— **不写 XML**（列表/详情都按 article_id 取）。
 */
public interface ArticleContentMapper extends BaseMapper<ArticleContentDO> {
}
