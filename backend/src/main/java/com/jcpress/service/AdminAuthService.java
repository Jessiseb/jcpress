package com.jcpress.service;

import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.vo.AdminUserVO;
import com.jcpress.domain.vo.LoginVO;

/**
 * 后台认证。
 *
 * **命名例外（已记入 docs/decisions.md #114）**：`login` / `logout` 不以
 * get/list/count/save/insert/remove/delete/update 开头。
 * Agent.md 那组前缀是给 CRUD 方法定的，而认证是**领域动作**、没有对应词 ——
 * 硬套成 `saveLogin` / `getToken` 只会让名字变得不准确（login 会写 Redis、写审计、
 * 更新最近登录信息，叫 get 是误导）。所以架构卡口显式放行这两个动词，而不是放宽整条规则。
 */
public interface AdminAuthService {

    LoginVO login(AdminLoginDTO dto, String clientIp, String userAgent);

    void logout(String clientIp, String userAgent);

    AdminUserVO getCurrentAdmin();
}
