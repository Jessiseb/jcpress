package com.jcpress.infrastructure.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AI 排版的模型接入配置。
 *
 * 走 **OpenAI 兼容**协议（{@code POST {base-url}/chat/completions}），所以换服务商只改配置、
 * 不动代码。常见三家的 base-url：
 * <ul>
 *   <li>DeepSeek：{@code https://api.deepseek.com/v1}</li>
 *   <li>通义千问（兼容模式）：{@code https://dashscope.aliyuncs.com/compatible-mode/v1}</li>
 *   <li>智谱 GLM：{@code https://open.bigmodel.cn/api/paas/v4}</li>
 * </ul>
 *
 * **api-key 只从环境变量进**（与 DB_PASSWORD 同一套注入方式，见 deploy/deploy-backend.sh 的 .env）——
 * 它绝不出现在仓库、日志或任何接口响应里。
 */
@Component
@Getter
public class AiProperties {

    private final String baseUrl;
    private final String model;
    private final String apiKey;
    private final int timeoutSeconds;
    /** 是否要求上游返回严格 JSON（OpenAI 兼容的 response_format）。关掉只在服务商不支持该字段时用 */
    private final boolean jsonMode;

    public AiProperties(
            @Value("${jcpress.ai.base-url:}") String baseUrl,
            @Value("${jcpress.ai.model:}") String model,
            @Value("${jcpress.ai.api-key:}") String apiKey,
            @Value("${jcpress.ai.timeout-seconds:60}") int timeoutSeconds,
            @Value("${jcpress.ai.json-mode:true}") boolean jsonMode) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.model = model == null ? "" : model.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.timeoutSeconds = timeoutSeconds;
        this.jsonMode = jsonMode;
    }

    /**
     * 三项齐全才算配置好。**缺任何一项都当作"未配置"**，由调用方明确报错 ——
     * 不做"少了 model 就悄悄用个默认值"这种事：那种降级只会在计费单上才被发现。
     */
    public boolean isConfigured() {
        return !baseUrl.isBlank() && !model.isBlank() && !apiKey.isBlank();
    }
}
