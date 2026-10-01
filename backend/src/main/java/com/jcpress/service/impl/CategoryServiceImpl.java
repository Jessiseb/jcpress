package com.jcpress.service.impl;

import com.jcpress.domain.converter.TaxonomyConverter;
import com.jcpress.domain.vo.CategoryVO;
import com.jcpress.repository.CategoryMapper;
import com.jcpress.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private static final String DEFAULT_SCOPE = "TECH";

    private final CategoryMapper categoryMapper;

    @Override
    public List<CategoryVO> listByScope(String scope) {
        String effectiveScope = (scope == null || scope.isBlank()) ? DEFAULT_SCOPE : scope;
        return TaxonomyConverter.toCategoryVOs(categoryMapper.listWithPublishedCount(effectiveScope));
    }
}
