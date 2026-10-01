package com.jcpress.service;

import com.jcpress.domain.vo.CategoryVO;

import java.util.List;

public interface CategoryService {

    /** scope 为空时回退 TECH（前台默认只看技术分类） */
    List<CategoryVO> listByScope(String scope);
}
