# -*- coding: utf-8 -*-
"""限流探针：AiConstant.RATE_LIMIT = 10 次/分钟。

用极短正文，前几次会真调模型（成本可忽略），超限那次应在**调模型之前**就被拒，
所以后面的请求不会产生任何费用。
"""
import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8091/api")
TOKEN_NAME = "jcpress-token"


def post(path, payload, token=None, timeout=120):
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, raw


if __name__ == "__main__":
    status, body = post("/v1/admin/auth/login",
                        {"username": os.environ.get("ADMIN_USER", "admin"),
                         "password": os.environ.get("ADMIN_PASS", "jcpress@2026")})
    token = body["data"]["token"]
    print("登录完成")

    for i in range(1, 13):
        status, body = post("/v1/admin/ai/format", {"contentMd": "限流测试", "title": "t"}, token)
        code = body.get("code") if isinstance(body, dict) else body
        msg = body.get("message") if isinstance(body, dict) else ""
        print("  第 %2d 次 → HTTP %s code=%s %s" % (i, status, code, msg))
