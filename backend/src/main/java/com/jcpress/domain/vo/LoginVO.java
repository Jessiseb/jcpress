package com.jcpress.domain.vo;

import lombok.Data;

/**
 * 登录结果：token 值 + **请求头名称**一起下发。
 *
 * 为什么要带头名：前端不必把 `jcpress-token` 写死；将来换 token-name 配置，
 * 前端不用跟着改（契约里带上，防漂）。
 */
@Data
public class LoginVO {

    private String token;
    private String tokenName;
    private AdminUserVO admin;
}
