package com.jcpress.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jcpress.domain.dataobject.AdminUserDO;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

public interface AdminUserMapper extends BaseMapper<AdminUserDO> {

    AdminUserDO getByUsername(@Param("username") String username);

    int updateLastLogin(@Param("id") Long id,
                        @Param("loginTime") LocalDateTime loginTime,
                        @Param("loginIp") String loginIp);
}
