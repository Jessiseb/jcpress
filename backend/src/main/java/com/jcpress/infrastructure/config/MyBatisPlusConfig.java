package com.jcpress.infrastructure.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置。
 *
 * ⚠️ 这里**故意不配置全局逻辑删除**（模板的 yml 里有 {@code logic-delete-field: isDelete}）。
 * 本项目的表没有 {@code is_delete} 列，照抄会让**每一条查询**都拼上 {@code is_delete=0} 而直接报错。
 * 删除策略见规划 §6.6：一期物理删除。
 */
@Configuration
public class MyBatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
