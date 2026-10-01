package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("tag")
public class TagDO {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String slug;
    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;
}
