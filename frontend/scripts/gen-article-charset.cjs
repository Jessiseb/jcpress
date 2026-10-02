#!/usr/bin/env node
/**
 * 文章页字符表：GB2312 **区 1–9（符号与标点）+ 区 16–55（一级汉字 3755）**。
 *
 * 为什么需要它：一期那套自托管衬线子集是从**静态 DOM** 收集的 531 字，而文章正文/标题
 * 是后台随时写的 —— 任何表外汉字都会回落到系统宋体，同一段里出现两款字（README 与 #38 写过这个坑）。
 * 动态内容永远追不上字符表，所以文章页改用「一级字库全覆盖」的独立子集。
 *
 * ⚠️ **计划原文只写了「一级字库 3755 字」（0xB0A1–0xD7F9），那是不够的** ——
 * 一级字库只有汉字，**不含中文标点**。实测文章 H1「三期后端复盘：模板、Redis 版本与『没人守』的规则」
 * 里的 `、`（U+3001）、`「」`（U+300C/D）、`：`（U+FF1A）全都缺，会在文章页回落到系统宋体 ——
 * 正是这套子集要解决的问题本身。GB2312 的标点/符号在**区 1–9**（high 字节 0xA1–0xA9），
 * 所以字符表扩成「区 1–9 + 区 16–55」。
 *
 * 零依赖：Node 自带 full-icu，TextDecoder('gbk') 能直接解码区位码。
 * 用法：npm run fonts:chars:article → 写 frontend/.tmp/fonts/chars-article.txt
 */
const fs = require('fs')
const path = require('path')

const OUT = path.resolve(__dirname, '../.tmp/fonts/chars-article.txt')
const decoder = new TextDecoder('gbk')

const chars = []
const push = (high, low) => {
  const decoded = decoder.decode(new Uint8Array([high, low]))
  if (decoded.length === 1 && decoded !== '\uFFFD') chars.push(decoded)
}

// 区 1–9：符号、标点、序号、假名、希腊/西里尔字母、拼音、制表符（GB2312 的符号区）
for (let high = 0xa1; high <= 0xa9; high++) {
  for (let low = 0xa1; low <= 0xfe; low++) push(high, low)
}

// 区 16–55：一级汉字 3755 字（0xB0A1–0xD7F9，末尾 5 个未分配）
for (let high = 0xb0; high <= 0xd7; high++) {
  for (let low = 0xa1; low <= 0xfe; low++) {
    if (high === 0xd7 && low > 0xf9) continue // 0xD7FA–0xD7FE 未分配
    push(high, low)
  }
}

const unique = [...new Set(chars)]
const hanzi = unique.filter((c) => {
  const cp = c.codePointAt(0)
  return cp >= 0x4e00 && cp <= 0x9fff
}).length
if (hanzi !== 3755) {
  console.error(`✘ 一级汉字应 3755 字，实际 ${hanzi} —— 区位边界写错了`)
  process.exit(1)
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, unique.join(''), 'utf8')
console.log(`✔ 写入 ${path.relative(process.cwd(), OUT)}：${unique.length} 字（其中一级汉字 ${hanzi} + 符号 ${unique.length - hanzi}）`)
