package com.jcpress.domain.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 后台账号（只有后台管理系统需要账号；前台访客没有账号、也没有注册入口）。
 *
 * 口令只以 BCrypt 哈希形式存在，**任何 VO 都不得包含 passwordHash** ——
 * 由 `AdminUserVO` 的字段声明与 `AdminAuthServiceTest` 的断言共同兜住。
 */
@Data
@TableName("admin_user")
public class AdminUserDO {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String passwordHash;
    private String nickname;
    private String role;

    /** 1 正常 0 禁用 */
    private Integer status;

    private LocalDateTime lastLoginTime;
    private String lastLoginIp;
    private LocalDateTime gmtCreate;
    private LocalDateTime gmtModified;
}
