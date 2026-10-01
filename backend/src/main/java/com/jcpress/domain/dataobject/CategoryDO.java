package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 分类 / 算法专题。靠 scope 区分两棵树（TECH / ALGO），不再造第二张专题表 ——
 * 树形结构、层级、计数、下拉导航这套管线因此只写一遍（规划 §6.2）。
 */
@Data
@TableName("category")
public class CategoryDO {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String scope;

    /** 0 为顶级；逻辑外键，无 FK 约束 */
    private Long parentId;
    private String name;
    private String slug;
    private String description;
    private Integer sort;
    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;
}
