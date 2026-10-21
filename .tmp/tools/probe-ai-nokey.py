# -*- coding: utf-8 -*-
"""未配置 api-key 时的行为探针 —— 这是「不引 Spring AI」这个决策的核心论据。

期望：应用照常启动；接口明确返回 50002 AI_NOT_CONFIGURED（HTTP 503）。
对照组是 Spring AI：starter 在 classpath 而缺 key 时，**应用直接启动失败**。
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8091/api")


def post(path, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["jcpress-token"] = token
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


if __name__ == "__main__":
    print("=== ① 应用是否照常起来（健康检查） ===")
    try:
        with urllib.request.urlopen(BASE + "/actuator/health", timeout=10) as resp:
            print("  HTTP %s → %s" % (resp.status, resp.read().decode()))
    except Exception as e:  # noqa: BLE001
        print("  健康检查失败: %s" % e)
        sys.exit(1)

    print("\n=== ② 登录 ===")
    status, body = post("/v1/admin/auth/login",
                        {"username": os.environ.get("ADMIN_USER", "admin"),
                         "password": os.environ.get("ADMIN_PASS", "jcpress@2026")})
    print("  HTTP %s" % status)
    token = body["data"]["token"]

    print("\n=== ③ 调 AI 排版（应 50002 / HTTP 503） ===")
    status, body = post("/v1/admin/ai/format", {"contentMd": "测试未配置"}, token)
    print("  HTTP %s → %s" % (status, json.dumps(body, ensure_ascii=False)))

    ok = status == 503 and body.get("code") == 50002
    print("\n  判定: %s" % ("OK —— 应用没配 key 照样运行，只是这个能力不可用"
                           if ok else "!! 与预期不符"))
