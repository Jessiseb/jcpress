package com.jcpress.service.impl;

import com.jcpress.domain.converter.TaxonomyConverter;
import com.jcpress.domain.vo.TagVO;
import com.jcpress.repository.TagMapper;
import com.jcpress.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TagServiceImpl implements TagService {

    private final TagMapper tagMapper;

    @Override
    public List<TagVO> listWithCount() {
        return TaxonomyConverter.toTagVOs(tagMapper.listWithPublishedCount());
    }
}
