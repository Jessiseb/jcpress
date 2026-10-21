# -*- coding: utf-8 -*-
"""长文探针：用项目里真实的文章跑一次，重点验「保真」而不是「好看」。

保真判据（输入 vs 输出的结构计数）：
  标题行数 / 代码块数 / 链接数 / 无序列表项数 / 表格行数 / 正文字符数
任何一项明显变小，都说明模型在偷偷删内容 —— 那是这个功能最不能接受的失败方式。
"""
import json
import os
import re
import time
import urllib.error
import urllib.request

BASE = os.environ.get("DS_BASE", "https://api.deepseek.com")
MODEL = os.environ.get("DS_MODEL", "deepseek-flash")
KEY = os.environ["DS_KEY"]
SRC = os.environ["SRC_MD"]

SYSTEM_PROMPT = """你是技术博客的排版助手。把用户给的 Markdown 正文整理成规范格式（标题层级、列表符号、代码块语言标注、空行、中英文之间空格、表格分隔行），并抽取元信息。

绝对不要新增、删除或改写任何技术事实、结论与数字，不要扩写也不要缩写，不要删原有链接、图片与代码。原文有的段落一个都不能少。
用户给的标题用来补一个一级标题。

输出 JSON：{"contentMd": "整理后的完整正文", "summary": "不超过 120 字", "tags": ["3 到 6 个标签"], "slug": "kebab-case 英文短名，无足够英文信息时给 null"}
只输出 JSON。"""


def stats(md):
    return {
        "字符数": len(md),
        "标题行": len(re.findall(r"(?m)^#{1,6}\s", md)),
        "代码块": md.count("```") // 2,
        "链接": len(re.findall(r"\]\(", md)),
        "无序列表项": len(re.findall(r"(?m)^\s*[-*+]\s", md)),
        "表格行": len(re.findall(r"(?m)^\s*\|", md)),
    }


def call(payload):
    req = urllib.request.Request(
        BASE + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY},
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8")), time.time() - t0, None
    except urllib.error.HTTPError as e:
        return None, time.time() - t0, "HTTP %s %s" % (e.code, e.read().decode("utf-8", "replace")[:400])
    except Exception as e:  # noqa: BLE001
        return None, time.time() - t0, "%s: %s" % (type(e).__name__, e)


if __name__ == "__main__":
    raw = open(SRC, encoding="utf-8").read()
    # 首行当作标题
    lines = raw.split("\n")
    title = lines[0].lstrip("# ").strip()
    body = "\n".join(lines[1:]).strip()

    print("源文件: %s" % SRC)
    print("标题: %s" % title)
    print("-- 输入结构 --")
    for k, v in stats(body).items():
        print("  %s = %s" % (k, v))

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "标题：%s\n\n正文：\n%s" % (title, body)},
        ],
        "temperature": 0.2,
        "max_tokens": 16000,
        "response_format": {"type": "json_object"},
    }
    body_resp, elapsed, err = call(payload)
    if err:
        print("\n失败（%.1fs）: %s" % (elapsed, err))
        raise SystemExit(1)

    choice = body_resp["choices"][0]
    msg = choice["message"]
    usage = body_resp.get("usage", {})
    print("\n-- 调用 --")
    print("  耗时 %.1fs | prompt=%s completion=%s | finish=%s | reasoning 字符=%d"
          % (elapsed, usage.get("prompt_tokens"), usage.get("completion_tokens"),
             choice.get("finish_reason"), len(msg.get("reasoning_content") or "")))

    data = json.loads(msg["content"])
    out = data.get("contentMd") or ""
    print("\n-- 输出结构 --")
    for k, v in stats(out).items():
        print("  %s = %s" % (k, v))

    print("\n-- 保真比对（输出 / 输入） --")
    a, b = stats(body), stats(out)
    for k in a:
        delta = b[k] - a[k]
        flag = "OK" if delta >= 0 or k == "字符数" else "!! 变少"
        if k == "字符数":
            flag = "OK" if b[k] >= a[k] * 0.9 else "!! 疑被缩写"
        print("  %-10s %s → %s  (%+d) %s" % (k, a[k], b[k], delta, flag))

    print("\n-- 元信息 --")
    print("  summary = %s" % data.get("summary"))
    print("  slug    = %s" % data.get("slug"))
    print("  tags    = %s" % data.get("tags"))
    print("\n-- 输出正文（前 1600 字） --")
    print(out[:1600])
