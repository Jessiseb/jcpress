# -*- coding: utf-8 -*-
"""端到端探针：登录后台 → 调 AI 排版接口 → 校验返回契约。

验的是真实 HTTP 链路，包括 Sa-Token 鉴权、限流、以及 VO 的字段边界。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8091/api")
USERNAME = os.environ.get("ADMIN_USER", "admin")
PASSWORD = os.environ.get("ADMIN_PASS", "jcpress@2026")
TOKEN_NAME = "jcpress-token"


def post(path, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers[TOKEN_NAME] = token
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, raw


MESSY_MD = """##为什么要用 RestClient
Spring 6.1 引入了 RestClient,它是 RestTemplate 的替代品。
主要好处:
1.流式 API,写起来短
2.默认就支持超时配置
对比一下:

|      | RestTemplate | RestClient |
|------|----|-----|
| 引入版本 | 3.0 | 6.1 |
| 流式 API | 不支持 |支持|

调用 deepseek 的代码大概长这样:
```java
var restClient = RestClient.builder().baseUrl("https://api.deepseek.com").build();
```
"""


if __name__ == "__main__":
    print("=== ① 未登录访问（应 401） ===")
    status, body = post("/v1/admin/ai/format", {"contentMd": "x"})
    print("  HTTP %s → %s" % (status, json.dumps(body, ensure_ascii=False)[:200]))

    print("\n=== ② 登录 ===")
    status, body = post("/v1/admin/auth/login", {"username": USERNAME, "password": PASSWORD})
    print("  HTTP %s" % status)
    if status != 200 or body.get("code") != 0:
        print("  登录失败: %s" % json.dumps(body, ensure_ascii=False)[:300])
        sys.exit(1)
    data = body["data"]
    token = data["token"]
    print("  tokenName=%s token=%s..." % (data.get("tokenName"), str(token)[:12]))

    print("\n=== ③ 调 AI 排版 ===")
    t0 = time.time()
    status, body = post("/v1/admin/ai/format",
                        {"contentMd": MESSY_MD, "title": "Spring Boot 里用 RestClient 调大模型"},
                        token=token)
    elapsed = time.time() - t0
    print("  HTTP %s | 耗时 %.1fs | code=%s" % (status, elapsed, body.get("code")))
    if status != 200 or body.get("code") != 0:
        print("  失败: %s" % json.dumps(body, ensure_ascii=False)[:500])
        sys.exit(1)

    vo = body["data"]
    print("\n--- 返回字段 ---")
    print("  summary = %s" % vo.get("summary"))
    print("  slug    = %s  (长度 %s)" % (vo.get("slug"), len(vo.get("slug") or "")))
    print("  tags    = %s  (个数 %s)" % (vo.get("tags"), len(vo.get("tags") or [])))
    print("  contentMd 长度 = %s" % len(vo.get("contentMd") or ""))

    print("\n--- contentMd 全文 ---")
    print(vo.get("contentMd"))

    print("\n--- 契约校验 ---")
    checks = [
        ("contentMd 非空", bool(vo.get("contentMd"))),
        ("slug 合规", vo.get("slug") is None or all(c.islower() or c.isdigit() or c == "-"
                                                   for c in (vo.get("slug") or "x"))),
        ("tags ≤ 6", len(vo.get("tags") or []) <= 6),
        ("summary ≤ 500", len(vo.get("summary") or "") <= 500),
        ("未泄漏 reasoning_content", "reasoning" not in json.dumps(vo, ensure_ascii=False)),
    ]
    for name, ok in checks:
        print("  [%s] %s" % ("OK" if ok else "!!", name))
