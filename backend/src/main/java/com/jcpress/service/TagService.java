package com.jcpress.service;

import com.jcpress.domain.vo.TagVO;

import java.util.List;

public interface TagService {

    List<TagVO> listWithCount();
}
