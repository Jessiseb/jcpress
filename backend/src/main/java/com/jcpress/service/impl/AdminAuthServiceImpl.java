package com.jcpress.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.converter.AdminConverter;
import com.jcpress.domain.dataobject.AdminUserDO;
import com.jcpress.domain.dto.AdminLoginDTO;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.vo.AdminUserVO;
import com.jcpress.domain.vo.LoginVO;
import com.jcpress.manager.RateLimitManager;
import com.jcpress.repository.AdminUserMapper;
import com.jcpress.service.AdminAuthService;
import com.jcpress.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuthServiceImpl implements AdminAuthService {

    private static final String ROUTE_LOGIN = "login";

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitManager rateLimitManager;
    private final AuditLogService auditLogService;

    /**
     * 顺序很关键：**先看锁定 → 再看限流 → 最后校验口令**。
     *
     * 反过来的话，攻击者可以用正确口令探测"账号是否被锁"，而锁定本身就失去了意义。
     * 失败信息统一成"用户名或密码错误"，不区分"用户不存在"与"密码错"（不泄露账号是否存在）。
     */
    @Override
    @Transactional
    public LoginVO login(AdminLoginDTO dto, String clientIp, String userAgent) {
        String failKey = RedisKeyConstant.LOGIN_FAIL.formatted(dto.getUsername());
        if (rateLimitManager.getCount(failKey) >= AdminConstant.LOGIN_FAIL_LIMIT) {
            log.warn("后台登录被锁定 username={} ip={}", dto.getUsername(), clientIp);
            throw new BusinessException(ErrorCodeEnum.LOGIN_FAIL_LOCKED);
        }

        String rateKey = RedisKeyConstant.RATE_LIMIT.formatted(clientIp, ROUTE_LOGIN);
        if (!rateLimitManager.tryAcquire(rateKey, AdminConstant.LOGIN_RATE_LIMIT,
                Duration.ofSeconds(AdminConstant.LOGIN_RATE_WINDOW_SECONDS))) {
            throw new BusinessException(ErrorCodeEnum.RATE_LIMITED);
        }

        AdminUserDO admin = adminUserMapper.getByUsername(dto.getUsername());
        if (admin == null || !passwordEncoder.matches(dto.getPassword(), admin.getPasswordHash())) {
            long failures = rateLimitManager.countUp(failKey,
                    Duration.ofSeconds(AdminConstant.LOGIN_FAIL_WINDOW_SECONDS));
            log.warn("后台登录失败 username={} ip={} 累计失败={}", dto.getUsername(), clientIp, failures);
            throw new BusinessException(ErrorCodeEnum.NOT_LOGIN, "用户名或密码错误");
        }
        if (admin.getStatus() == null || admin.getStatus() != AdminConstant.STATUS_ENABLED) {
            log.warn("后台登录被拒（账号禁用） username={}", dto.getUsername());
            throw new BusinessException(ErrorCodeEnum.FORBIDDEN, "账号已禁用");
        }

        rateLimitManager.reset(failKey);
        StpUtil.login(admin.getId());
        adminUserMapper.updateLastLogin(admin.getId(), LocalDateTime.now(), clientIp);
        saveAudit(admin.getId(), AuditActionConstant.LOGIN, null, "登录成功", clientIp, userAgent);

        LoginVO vo = new LoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setTokenName(StpUtil.getTokenName());
        vo.setAdmin(AdminConverter.toAdminUserVO(admin));
        return vo;
    }

    @Override
    public void logout(String clientIp, String userAgent) {
        Long adminId = StpUtil.getLoginIdAsLong();
        StpUtil.logout();
        saveAudit(adminId, AuditActionConstant.LOGOUT, null, "登出", clientIp, userAgent);
    }

    @Override
    public AdminUserVO getCurrentAdmin() {
        Long adminId = StpUtil.getLoginIdAsLong();
        AdminUserDO admin = adminUserMapper.selectById(adminId);
        if (admin == null) {
            // token 有效但账号已被删掉：按未登录处理，不抛 500
            throw new BusinessException(ErrorCodeEnum.NOT_LOGIN);
        }
        return AdminConverter.toAdminUserVO(admin);
    }

    private void saveAudit(Long adminId, String action, Long targetId, String detail,
                           String clientIp, String userAgent) {
        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(action);
        audit.setTargetId(targetId);
        audit.setDetail(detail);
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);
    }
}
