package com.jcpress.service.impl;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.jcpress.common.constant.AiConstant;
import com.jcpress.common.constant.AuditActionConstant;
import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.exception.BusinessException;
import com.jcpress.common.exception.ErrorCodeEnum;
import com.jcpress.common.util.SlugUtils;
import com.jcpress.domain.dto.AiFormatDTO;
import com.jcpress.domain.dto.AuditLogDTO;
import com.jcpress.domain.vo.AiFormatVO;
import com.jcpress.infrastructure.config.AiProperties;
import com.jcpress.infrastructure.config.GsonConfig;
import com.jcpress.manager.RateLimitManager;
import com.jcpress.service.AiFormatService;
import com.jcpress.service.AuditLogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 调 OpenAI 兼容接口做排版整理。
 *
 * 用 Spring 6.1 自带的 {@link RestClient}，**不引 Spring AI** —— 理由见 decisions.md #120：
 * 它的 starter 只要在 classpath，缺 api-key 就会让整个应用起不来，而本站的 AI 是可选增强。
 *
 * 三个实测得来的实现约束（都写进了下面的常量注释）：
 * 1. 必须开 `response_format=json_object`。裸 prompt 让模型"直接给 JSON"时，它会把预算全花在
 *    思考内容上，实测 `finish_reason=length` 且 `content` 为空；
 * 2. `max_tokens` 要给足。思考内容同样计入 completion_tokens，给少了正文会被挤掉；
 * 3. 只取 `message.content`，`message.reasoning_content` 是模型的思考过程，不能回给前端。
 */
@Service
@Slf4j
public class AiFormatServiceImpl implements AiFormatService {

    private static final Gson GSON = GsonConfig.buildGson();

    private static final String CHAT_PATH = "/chat/completions";

    /** 排版是确定性任务，温度调低减少发挥 */
    private static final double TEMPERATURE = 0.2;

    /**
     * 输出上限。实测一篇 3400 字正文的调用 completion_tokens 约 1 万（大头是思考内容），
     * 所以这里必须留够余量：给少了不会报错，而是静默返回空正文。
     */
    private static final int MAX_OUTPUT_TOKENS = 32000;

    private static final String SYSTEM_PROMPT = """
            你是技术博客的排版助手。把用户给的 Markdown 正文整理成规范格式，并抽取元信息。

            ## 只做这些格式整理
            - 修正标题层级，不出现跳级；用用户给的标题补一级标题
            - 无序列表统一用 `-`；有序列表**保留原文的编号**（1. 2. 3.），只补上点号后缺的空格
            - 代码块补语言标注；行内代码用反引号
            - 连续空行收紧为一个
            - 中英文之间、中文与数字之间加一个空格
            - 表格补齐分隔行并对齐

            ## 这些绝对不要做
            - 不新增、不删除、不改写任何技术事实、结论与数字
            - 不扩写，也不缩写成另一篇文章；原文的段落一个都不能少
            - 不删原有的链接、图片、代码
            - 不加原文没有的小标题、总结段、emoji

            ## 输出 JSON
            {
              "contentMd": "整理后的完整正文（Markdown）",
              "summary": "不超过 120 字，陈述事实不推销",
              "tags": ["3 到 6 个技术标签，写技术名而不是 id"],
              "slug": "kebab-case 英文短名，只含小写字母数字和短横线，3 到 60 字符；标题里没有足够英文信息时给 null"
            }
            只输出 JSON，不要任何额外说明。
            """;

    private final AiProperties aiProperties;
    private final RateLimitManager rateLimitManager;
    private final AuditLogService auditLogService;

    /** 配置不全时为 null —— 缺 key 就是"不提供该能力"，而不是拿空 key 去撞上游 */
    private final RestClient restClient;

    public AiFormatServiceImpl(AiProperties aiProperties,
                               RateLimitManager rateLimitManager,
                               AuditLogService auditLogService) {
        this.aiProperties = aiProperties;
        this.rateLimitManager = rateLimitManager;
        this.auditLogService = auditLogService;
        this.restClient = aiProperties.isConfigured() ? buildRestClient() : null;
    }

    @Override
    public AiFormatVO formatArticle(AiFormatDTO dto, Long adminId, String clientIp, String userAgent) {
        RestClient client = this.restClient;
        if (client == null) {
            throw new BusinessException(ErrorCodeEnum.AI_NOT_CONFIGURED);
        }

        String contentMd = dto.getContentMd() == null ? "" : dto.getContentMd();
        if (contentMd.length() > AiConstant.MAX_INPUT_CHARS) {
            // 截断会让模型基于半截文章排版，产出看着正常实则丢内容 —— 宁可直接拒
            throw new BusinessException(ErrorCodeEnum.PARAM_ERROR,
                    "正文超过 " + AiConstant.MAX_INPUT_CHARS + " 字，请分段排版");
        }

        String rateKey = RedisKeyConstant.RATE_LIMIT.formatted(clientIp, AiConstant.ROUTE);
        if (!rateLimitManager.tryAcquire(rateKey, AiConstant.RATE_LIMIT,
                Duration.ofSeconds(AiConstant.RATE_WINDOW_SECONDS))) {
            throw new BusinessException(ErrorCodeEnum.RATE_LIMITED);
        }

        long startedAt = System.currentTimeMillis();
        AiFormatVO vo = requestModel(client, dto.getTitle(), contentMd);
        log.info("AI 排版完成 adminId={} 耗时={}ms 输入={}字 输出={}字",
                adminId, System.currentTimeMillis() - startedAt, contentMd.length(),
                vo.getContentMd() == null ? 0 : vo.getContentMd().length());

        saveAudit(adminId, contentMd, vo, clientIp, userAgent);
        return vo;
    }

    private RestClient buildRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = Math.toIntExact(Duration.ofSeconds(aiProperties.getTimeoutSeconds()).toMillis());
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return RestClient.builder()
                .baseUrl(aiProperties.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    private AiFormatVO requestModel(RestClient client, String title, String contentMd) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", aiProperties.getModel());
        payload.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", buildUserPrompt(title, contentMd))));
        payload.put("temperature", TEMPERATURE);
        payload.put("max_tokens", MAX_OUTPUT_TOKENS);
        if (aiProperties.isJsonMode()) {
            payload.put("response_format", Map.of("type", "json_object"));
        }

        String responseBody;
        try {
            responseBody = client.post()
                    .uri(CHAT_PATH)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + aiProperties.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(GSON.toJson(payload))
                    .retrieve()
                    .body(String.class);
        } catch (ResourceAccessException e) {
            log.warn("AI 排版上游不可达: {}", e.getMessage());
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 服务连接超时，请重试");
        } catch (RestClientResponseException e) {
            // 上游响应体可能带账号信息，只落在服务端日志里，不回显给前端
            log.warn("AI 排版上游返回 {}: {}", e.getStatusCode(), truncate(e.getResponseBodyAsString(), 500));
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 服务返回错误（HTTP " + e.getStatusCode().value() + "）");
        }
        return parseResponse(responseBody);
    }

    private AiFormatVO parseResponse(String body) {
        JsonObject root;
        try {
            root = JsonParser.parseString(body).getAsJsonObject();
        } catch (RuntimeException e) {
            log.warn("AI 排版上游响应不是 JSON: {}", truncate(body, 300));
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR);
        }

        JsonArray choices = root.getAsJsonArray("choices");
        if (choices == null || choices.isEmpty()) {
            log.warn("AI 排版上游响应缺少 choices: {}", truncate(body, 300));
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR);
        }
        JsonObject choice = choices.get(0).getAsJsonObject();
        String finishReason = asText(choice.get("finish_reason"));
        JsonObject message = choice.getAsJsonObject("message");
        String content = message == null ? null : asText(message.get("content"));

        if (content == null || content.isBlank()) {
            // 实测会撞上：思考内容吃光 max_tokens 时 content 就是空的
            log.warn("AI 排版上游返回空正文 finish_reason={}", finishReason);
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 返回内容为空，请重试");
        }
        if ("length".equals(finishReason)) {
            log.warn("AI 排版被 max_tokens 截断");
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 输出被截断，请缩短正文后重试");
        }
        return toVo(parseModelJson(content));
    }

    /** 模型偶尔会用 ```json 包一层；剥掉再解析，别让它把整个功能搞挂 */
    private JsonObject parseModelJson(String content) {
        String text = content.trim();
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            text = firstNewline > 0 ? text.substring(firstNewline + 1) : text;
            int fence = text.lastIndexOf("```");
            if (fence >= 0) {
                text = text.substring(0, fence);
            }
            text = text.trim();
        }
        try {
            return JsonParser.parseString(text).getAsJsonObject();
        } catch (RuntimeException e) {
            log.warn("AI 排版返回内容不可解析: {}", truncate(text, 300));
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 返回格式不可解析");
        }
    }

    private AiFormatVO toVo(JsonObject model) {
        AiFormatVO vo = new AiFormatVO();
        vo.setContentMd(asText(model.get("contentMd")));
        vo.setSummary(clip(asText(model.get("summary")), AiConstant.MAX_SUMMARY_CHARS));
        vo.setSlug(normalizeSlug(asText(model.get("slug"))));
        vo.setTags(normalizeTags(model.getAsJsonArray("tags")));
        if (vo.getContentMd() == null || vo.getContentMd().isBlank()) {
            throw new BusinessException(ErrorCodeEnum.AI_UPSTREAM_ERROR, "AI 未返回正文");
        }
        return vo;
    }

    /**
     * 模型给的 slug 不保证合规（可能带大写、下划线、空格），所以不能直接采信。
     * 自己再规范化一次，仍不合规就返回 null —— 让前端别填，由人来定。
     */
    private String normalizeSlug(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String candidate = raw.trim();
        if (SlugUtils.isValid(candidate)) {
            return candidate;
        }
        String normalized = SlugUtils.normalize(candidate);
        return SlugUtils.isValid(normalized) ? normalized : null;
    }

    /** 去空、去重、截到上限；超出 ArticleSaveDTO 校验边界的东西一概不往回带 */
    private List<String> normalizeTags(JsonArray array) {
        if (array == null || array.isEmpty()) {
            return List.of();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (JsonElement element : array) {
            if (element == null || element.isJsonNull()) {
                continue;
            }
            String tag = element.getAsString().trim();
            if (!tag.isEmpty()) {
                unique.add(tag);
            }
            if (unique.size() >= AiConstant.MAX_TAGS) {
                break;
            }
        }
        return new ArrayList<>(unique);
    }

    private String buildUserPrompt(String title, String contentMd) {
        StringBuilder prompt = new StringBuilder();
        if (title != null && !title.isBlank()) {
            prompt.append("标题：").append(title.trim()).append("\n\n");
        }
        return prompt.append("正文：\n").append(contentMd).toString();
    }

    private void saveAudit(Long adminId, String input, AiFormatVO vo, String clientIp, String userAgent) {
        AuditLogDTO audit = new AuditLogDTO();
        audit.setAdminId(adminId);
        audit.setAction(AuditActionConstant.AI_FORMAT);
        audit.setTargetId(null);
        audit.setDetail(AiConstant.AUDIT_DETAIL_FORMAT.formatted(input.length(),
                vo.getContentMd() == null ? 0 : vo.getContentMd().length()));
        audit.setIp(clientIp);
        audit.setUserAgent(userAgent);
        auditLogService.saveLog(audit);
    }

    private static String asText(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return null;
        }
        return element.getAsString();
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    private static String truncate(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() <= max ? text : text.substring(0, max) + "...";
    }
}
