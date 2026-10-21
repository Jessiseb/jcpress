/**
 * 源模块编译体检：从 `/src/main.tsx` 出发，把 Vite 的**模块图整个爬一遍**，
 * 逐个请求并确认返回 200、且内容里没有错误标记。
 *
 * 为什么需要它：模块级失败（读取被系统拦、语法错、路径解析失败）只会让**那一个**
 * 页面白屏并在浏览器里弹遮罩，跑首页、健康检查、接口测试全都看不出来。2026-10-16
 * 就踩到一次：Vite 首次读取 `AdminArticleEditPage.tsx` 时被 Windows Defender 的
 * 实时防护拦成 `EPERM: operation not permitted`（新进程首次访问某文件时被扫描拦截），
 * 首页一切正常，只有后台编辑页炸。
 *
 * 顺带作用：把模块**预热**一遍。这既是体检，也把"新进程首次读取被拦"的那一次失败
 * 消化在启动阶段，而不是留给浏览器弹遮罩。
 *
 * 用法：node .tmp/tools/probe-vite-modules.cjs
 * 退出码：0 = 全部通过；1 = 有模块加载失败
 */
const BASE = process.env.VITE_BASE || 'http://127.0.0.1:8099'

/** 从编译产物里抠出所有以 `/` 开头的导入目标（相对导入已被 Vite 解析成绝对路径） */
const extractImports = (code) => {
  const out = []
  const re = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g
  let m
  while ((m = re.exec(code)) !== null) out.push(m[1])
  return out
}

const seen = new Set()
const queue = ['/src/main.tsx']
const failures = []
const checked = []
let fetches = 0
const MAX_FETCHES = 600 // 防跑飞

const crawl = async () => {
while (queue.length > 0 && fetches < MAX_FETCHES) {
  const url = queue.shift()
  const path = url.split('?')[0]
  if (seen.has(path)) continue
  seen.add(path)
  fetches++

  let res
  let code
  try {
    res = await fetch(BASE + url)
    code = await res.text()
  } catch (error) {
    failures.push({ url: path, status: 'FETCH_ERROR', detail: String(error).slice(0, 120) })
    continue
  }

  // Vite 对编译失败返回 500，body 是错误信息（EPERM / 语法错都在这里现形）
  if (!res.ok) {
    failures.push({
      url: path,
      status: res.status,
      detail: code.replace(/\s+/g, ' ').slice(0, 200),
    })
    continue
  }

  checked.push(path)
  for (const spec of extractImports(code)) {
    if (!spec.startsWith('/')) continue
    // 运行时资源（图片、字体）不必再爬，只确认当前模块能解析即可
    if (/\.(png|jpe?g|svg|gif|webp|woff2?|ttf|ico)(\?|$)/i.test(spec)) continue
    queue.push(spec)
  }
}
}

const report = () => {
  const byKind = (p) => {
    if (p.startsWith('/src/')) return 'src'
    if (p.startsWith('/node_modules/.vite/')) return 'deps'
    return 'other'
  }
  const tally = checked.reduce((acc, p) => ((acc[byKind(p)] = (acc[byKind(p)] || 0) + 1), acc), {})

  console.log(`模块图爬取完成：请求 ${fetches} 个，成功 ${checked.length} 个`)
  console.log(`  明细：${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' / ') || '（无）'}`)
  console.log(`  其中 /src/ 源模块 ${tally.src || 0} 个`)

  if (failures.length > 0) {
    console.log(`\n✗ 有 ${failures.length} 个模块加载失败：`)
    for (const f of failures) {
      console.log(`  ${f.status}  ${f.url}`)
      if (f.detail) console.log(`      ${f.detail}`)
    }
    process.exit(1)
  }

  console.log('\n✓ 全部模块编译通过，无 EPERM / 解析失败')
}

crawl().then(report).catch((error) => {
  console.error('爬取过程异常：', error)
  process.exit(1)
})
