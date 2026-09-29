#!/usr/bin/env node
/**
 * 展示字子集流水线（默认生成 public/fonts/serif-sc-500.woff2）。
 *
 * 流程：
 *   1. 下载 Noto Serif SC 变量字体（google/fonts 仓库，OFL 许可）到 .tmp/fonts/
 *   2. 实例化到目标字重（静态实例比变量子集小一半：92.7KB vs 176.8KB）
 *   3. 用浏览器收集「真实渲染出来的中文字符」（默认 collect-charset.cjs，当前 531 字）
 *   4. pyftsubset 出 woff2，只含这些字
 *
 * 依赖：Python 3 + fonttools + brotli（`python -m pip install fonttools brotli`）
 * 前置：dev server 在 5173 上跑着（第 3 步要开浏览器）
 * 用法：
 *   npm run fonts:build                  → 500 档（全量字符表）
 *   npm run fonts:build:display          → 700 档（只含展示字字符表，二期新增）
 *
 * 参数（二期 phase-2-visual 新增；不传任何参数时行为与一期完全一致）：
 *   --weight=700                实例化到指定字重（默认 500）
 *   --chars=<path>              字符表文件（默认 .tmp/fonts/chars.txt）
 *   --out=<path>                产物路径（默认 public/fonts/serif-sc-<weight>.woff2）
 *   --collect=<script|none>     用哪个脚本收集字符表；none = 不收集，直接用现有文件
 *
 * **何时必须重跑**：页面出现了字符表里没有的新汉字 —— 表现为那个字回落到系统字体、
 * 与相邻字不同款。加新文章（M3 详情页）时一定会遇到，跑完看一眼体积
 * （500 档正常 90–100KB；700 档只含展示字，**正常 8–15KB，实测 9.0KB / 45 字**）。
 *
 * ⚠️ 两档的字符表是**分别收集**的：500 档要覆盖全站正文，700 档只需覆盖展示字元素。
 * 700 档若漏字，会出现「同一行标题混用两档字重」—— 这正是
 * frontend/scripts/audit-display-font.cjs 要断言的东西。
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const FRONTEND = path.resolve(__dirname, '..')
const TMP = path.join(FRONTEND, '.tmp/fonts')
const PUBLIC = path.join(FRONTEND, 'public/fonts')
const VF = path.join(TMP, 'NotoSerifSC-VF.ttf')

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const weight = String(arg('weight', '500'))
const charsArg = arg('chars', '.tmp/fonts/chars.txt')
const collect = arg('collect', 'collect-charset.cjs')

const STATIC = path.join(TMP, `NotoSerifSC-${weight}.ttf`)
const CHARS = path.isAbsolute(charsArg) ? charsArg : path.join(FRONTEND, charsArg)
const OUT = path.isAbsolute(arg('out', ''))
  ? arg('out', '')
  : path.join(PUBLIC, arg('out', `serif-sc-${weight}.woff2`))

const VF_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'

const py = (args) => execFileSync('python', args, { stdio: 'inherit' })

fs.mkdirSync(TMP, { recursive: true })
fs.mkdirSync(PUBLIC, { recursive: true })

console.log(`目标字重 ${weight} / 字符表 ${path.relative(FRONTEND, CHARS)} / 产物 ${path.relative(FRONTEND, OUT)}`)

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

// 2. 实例化到目标字重
if (!fs.existsSync(STATIC)) {
  console.log(`实例化 wght=${weight} …`)
  py(['-m', 'fontTools.varLib.instancer', VF, `wght=${weight}`, '-o', STATIC])
}
console.log(`静态实例：${(fs.statSync(STATIC).size / 1024 / 1024).toFixed(1)} MB`)

// 3. 字符表
if (collect === 'none') {
  if (!fs.existsSync(CHARS)) {
    console.error(`✘ --collect=none 但字符表不存在：${CHARS}`)
    process.exit(1)
  }
  console.log('跳过字符表收集（--collect=none）')
} else {
  console.log(`收集真实渲染的字符表（${collect}）…`)
  execFileSync(process.execPath, [path.join(__dirname, collect)], { stdio: 'inherit' })
}
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
console.log(`\n✔ 子集完成：${path.relative(FRONTEND, OUT)}`)
console.log(`  字重 ${weight} / 字符数 ${charCount} / 体积 ${kb.toFixed(1)} KB`)
if (weight === '500' && kb > 150) console.log('  ⚠ 体积偏大：检查字符表是不是混进了注释里的字')
if (weight === '700' && kb > 25) console.log('  ⚠ 体积偏大：检查展示字字符表是不是混进了正文汉字')
