package com.jcpress.service;

import com.jcpress.common.constant.AdminConstant;
import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.domain.dto.AdminLoginDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * 认证服务的**失败路径**（锁定 / 限流 / 口令错）。
 *
 * ⚠️ 这里**不测"登录成功"**：成功路径会走到 `StpUtil.login()`，而 Sa-Token 的上下文是
 * **web 请求级**的 —— 非 web 的 `@SpringBootTest` 里直接调会抛 `SaTokenContextException`。
 * 那不是业务缺陷，是测法不对（见 docs/decisions.md #106）。
 *
 * 成功路径（发 token、清失败计数、`/me` 回显）全部由 `AdminAuthControllerTest` 走 MockMvc
 * 真实链路覆盖。好在失败路径全都发生在 `StpUtil.login` **之前**，所以在这里测得动。
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminAuthServiceTest {

    private static final String TEST_IP = "127.0.0.1";

    @Autowired
    AdminAuthService adminAuthService;

    @Autowired
    StringRedisTemplate redis;

    private AdminLoginDTO login(String username, String password) {
        AdminLoginDTO dto = new AdminLoginDTO();
        dto.setUsername(username);
        dto.setPassword(password);
        return dto;
    }

    @AfterEach
    void tearDown() {
        redis.delete(RedisKeyConstant.LOGIN_FAIL.formatted("admin"));
        redis.delete(RedisKeyConstant.RATE_LIMIT.formatted(TEST_IP, "login"));
        for (int i = 0; i <= 12; i++) {
            redis.delete(RedisKeyConstant.LOGIN_FAIL.formatted("probe-" + i));
        }
    }

    @Test
    void wrongPasswordIsRejectedAndCounted() {
        BusinessException e = catchThrowableOfType(                () -> adminAuthService.login(login("admin", "wrong-password"), TEST_IP, "JUnit"), BusinessException.class);

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.NOT_LOGIN.getCode());
        assertThat(e.getMessage()).isEqualTo("用户名或密码错误");
        assertThat(redis.opsForValue().get("login:fail:admin")).isEqualTo("1");
    }

    @Test
    void unknownUsernameGivesSameMessageSoAccountExistenceDoesNotLeak() {
        BusinessException e = catchThrowableOfType(                () -> adminAuthService.login(login("no-such-user", "whatever-123"), TEST_IP, "JUnit"), BusinessException.class);

        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.NOT_LOGIN.getCode());
        assertThat(e.getMessage()).isEqualTo("用户名或密码错误");
    }

    @Test
    void fifthFailureLocksTheAccountEvenWithCorrectPassword() {
        for (int i = 0; i < AdminConstant.LOGIN_FAIL_LIMIT; i++) {
            assertThatThrownBy(() -> adminAuthService.login(login("admin", "wrong-password"), TEST_IP, "JUnit"))
                    .isInstanceOf(BusinessException.class);
        }

        // 第 6 次即便给对的口令，也必须先被锁定拦住（锁定判定在口令校验之前）
        BusinessException e = catchThrowableOfType(                () -> adminAuthService.login(login("admin", "jcpress@2026"), TEST_IP, "JUnit"), BusinessException.class);
        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.LOGIN_FAIL_LOCKED.getCode());
    }

    @Test
    void loginRateLimitBlocksTheEleventhAttemptFromSameIp() {
        // 用 10 个不同用户名，避免先撞上"失败锁定"而根本测不到限流
        for (int i = 0; i < AdminConstant.LOGIN_RATE_LIMIT; i++) {
            int index = i;
            assertThatThrownBy(() -> adminAuthService.login(login("probe-" + index, "wrong-password"),
                    TEST_IP, "JUnit")).isInstanceOf(BusinessException.class);
        }

        BusinessException e = catchThrowableOfType(                () -> adminAuthService.login(login("probe-10", "wrong-password"), TEST_IP, "JUnit"), BusinessException.class);
        assertThat(e.getCode()).isEqualTo(ErrorCodeEnum.RATE_LIMITED.getCode());
    }
}
