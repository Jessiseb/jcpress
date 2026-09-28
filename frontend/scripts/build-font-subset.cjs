#!/usr/bin/env node
/**
 * 展示字子集流水线（生成 public/fonts/serif-sc-500.woff2）。
 *
 * 流程：
 *   1. 下载 Noto Serif SC 变量字体（google/fonts 仓库，OFL 许可）到 .tmp/fonts/
 *   2. 实例化到 wght=500（静态实例比变量子集小一半：92.7KB vs 176.8KB）
 *   3. 用浏览器收集「真实渲染出来的中文字符」（collect-charset.cjs，当前 531 字）
 *   4. pyftsubset 出 woff2，只含这些字
 *
 * 依赖：Python 3 + fonttools + brotli（`python -m pip install fonttools brotli`）
 * 前置：dev server 在 5173 上跑着（第 3 步要开浏览器）
 * 用法：npm run fonts:build
 *
 * **何时必须重跑**：页面出现了字符表里没有的新汉字 —— 表现为那个字回落到系统字体、
 * 与相邻字不同款。加新文章（M3 详情页）时一定会遇到，跑完看一眼体积（正常 90–100KB）。
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const FRONTEND = path.resolve(__dirname, '..')
const TMP = path.join(FRONTEND, '.tmp/fonts')
const PUBLIC = path.join(FRONTEND, 'public/fonts')
const VF = path.join(TMP, 'NotoSerifSC-VF.ttf')
const STATIC = path.join(TMP, 'NotoSerifSC-500.ttf')
const CHARS = path.join(TMP, 'chars.txt')
const OUT = path.join(PUBLIC, 'serif-sc-500.woff2')

const VF_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'

const py = (args) => execFileSync('python', args, { stdio: 'inherit' })

fs.mkdirSync(TMP, { recursive: true })
fs.mkdirSync(PUBLIC, { recursive: true })

// 1. 源字体
if (!fs.existsSync(VF)) {
  console.log('下载 Noto Serif SC 变量字体（约 24MB）…')
  execFileSync(
    'powershell',
    ['-Command', `Invoke-WebRequest -UseBasicParsing '${VF_URL}' -OutFile '${VF}' -TimeoutSec 900`],
    { stdio: 'inherit' },
  )
}
console.log(`源字体：${(fs.statSync(VF).size / 1024 / 1024).toFixed(1)} MB`)

// 2. 实例化到 500
if (!fs.existsSync(STATIC)) {
  console.log('实例化 wght=500 …')
  py(['-m', 'fontTools.varLib.instancer', VF, 'wght=500', '-o', STATIC])
}
console.log(`静态实例：${(fs.statSync(STATIC).size / 1024 / 1024).toFixed(1)} MB`)

// 3. 字符表
console.log('收集真实渲染的字符表 …')
execFileSync(process.execPath, [path.join(__dirname, 'collect-charset.cjs')], { stdio: 'inherit' })
const charCount = [...fs.readFileSync(CHARS, 'utf8')].length

// 4. 切子集
console.log('pyftsubset → woff2 …')
py([
  '-m',
  'fontTools.subset',
  STATIC,
  `--text-file=${CHARS}`,
  '--flavor=woff2',
  `--output-file=${OUT}`,
  '--layout-features=*',
  '--no-hinting',
  '--desubroutinize',
])

const kb = fs.statSync(OUT).size / 1024
console.log(`\n✔ 子集完成：public/fonts/serif-sc-500.woff2`)
console.log(`  字符数 ${charCount} / 体积 ${kb.toFixed(1)} KB`)
if (kb > 150) console.log('  ⚠ 体积偏大：检查字符表是不是混进了注释里的字')
