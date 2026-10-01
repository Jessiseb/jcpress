package com.jcpress.domain.vo;

import lombok.Data;

/**
 * 后台账号出参。**没有 passwordHash** —— 字段声明层面就保证了口令哈希不可能从这里漏出去。
 */
@Data
public class AdminUserVO {

    private Long id;
    private String username;
    private String nickname;
    private String role;
}
