const { chromium } = require('playwright-core')

/**
 * 移动端性能归因（二期 phase-2-visual）。
 *
 * 一期的 M2 DoD 里「Lighthouse 移动端 ≥ 90」从未验过；二期第一次跑出来是 **70 分**，
 * 瓶颈是 TBT（总阻塞时间）而不是 LCP/CLS。本脚本回答一个具体问题：
 * **这 2 秒的主线程阻塞里，常驻的流线布景层占多少？**
 *
 * 做法：同一份生产构建、同一视口、同一 CPU 降速，只改一件事 ——
 *   A 现状 / B 流线层 display:none / C 流线层保留但动画关掉
 * 各跑一次，比较「长任务总时长」与「掉帧率」。
 *
 * 用法：node .tmp/tools/audit-perf.cjs [url]（默认 http://127.0.0.1:4173/ 生产预览）
 */

const URL = process.argv[2] || 'http://127.0.0.1:4173/'
const VIEWPORT = { width: 390, height: 844 }

async function measure(browser, mode) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  // 与 Lighthouse 移动端同档：4× CPU 降速
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.addInitScript(() => {
    window.__longTasks = []
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longTasks.push(e.duration)
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      /* 不支持 longtask 就只报帧数据 */
    }
  })

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })

  if (mode !== 'A-现状') {
    await page.evaluate((m) => {
      const layer = document.querySelector('[data-flow]')
      if (!layer) return
      const paths = Array.from(layer.querySelectorAll('path'))
      if (m === 'B-隐藏流线层') layer.style.display = 'none'
      if (m === 'C-流线层不动画') paths.forEach((p) => (p.style.animation = 'none'))
      // D：只保留「光段沿线前进」，去掉 dasharray 呼吸（dash 图案每帧重算是最贵的一项）
      if (m === 'D-只保留位移') {
        paths.forEach((p) => {
          const names = getComputedStyle(p).animationName.split(',').map((s) => s.trim())
          p.style.animationName = names[0]
          p.style.animationTimingFunction = 'linear'
          p.style.animationIterationCount = 'infinite'
          p.style.animationDirection = 'normal'
        })
      }
      // E：只做透明度脉冲（纯绘制，不重算 dash 图案、不重新细分描边）
      if (m === 'E-只做透明度脉冲') {
        const style = document.createElement('style')
        style.textContent =
          '@keyframes perfPulse{0%,100%{opacity:.32}50%{opacity:.6}} .perf-pulse{animation:perfPulse 12s ease-in-out infinite alternate !important}'
        document.head.appendChild(style)
        paths.forEach((p, i) => {
          p.style.animation = 'none'
          p.classList.add('perf-pulse')
          p.style.animationDelay = `${(-0.8 * i).toFixed(1)}s`
        })
      }
      // F：保留全部三种动画，但把手机档路径数从 12×2 砍到 6×2（只留一半节点参与动画）
      if (m === 'F-手机档路径减半') {
        paths.forEach((p, i) => {
          if (i % 2 === 1) p.style.display = 'none'
        })
      }
      // G：目标组合 —— 位移（dashoffset）+ 透明度脉冲，**去掉 dasharray 呼吸**
      if (m === 'G-位移+脉冲(去呼吸)') {
        const style = document.createElement('style')
        style.textContent =
          '@keyframes perfTravel{from{stroke-dashoffset:0}to{stroke-dashoffset:-1}}' +
          '@keyframes perfPulse2{0%,100%{opacity:.35}50%{opacity:.6}}' +
          '.perf-g{animation:perfTravel 22s linear infinite, perfPulse2 12s ease-in-out infinite alternate !important}'
        document.head.appendChild(style)
        paths.forEach((p, i) => {
          p.style.animation = 'none'
          p.classList.add('perf-g')
          p.style.animationDelay = `${(-1.7 * i).toFixed(1)}s, ${(-0.9 * i).toFixed(1)}s`
          p.style.strokeDasharray = '0.55 0.45'
        })
      }
    }, mode)
  }

  // 采样 3 秒的帧间隔
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const gaps = []
        let last = performance.now()
        const started = last
        const tick = (now) => {
          gaps.push(now - last)
          last = now
          if (now - started < 3000) requestAnimationFrame(tick)
          else resolve(gaps)
        }
        requestAnimationFrame(tick)
      }),
  )

  const longTasks = await page.evaluate(() => window.__longTasks || [])
  await ctx.close()

  const sorted = [...frames].sort((a, b) => a - b)
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0
  const dropped = frames.filter((g) => g > 33).length / Math.max(frames.length, 1)
  const longTotal = longTasks.reduce((a, b) => a + b, 0)
  return {
    mode,
    frames: frames.length,
    fps: Math.round(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)),
    p50: Math.round(p(0.5)),
    p95: Math.round(p(0.95)),
    max: Math.round(sorted[sorted.length - 1] || 0),
    droppedPct: Math.round(dropped * 100),
    longTaskCount: longTasks.length,
    longTaskTotalMs: Math.round(longTotal),
    longTaskMaxMs: Math.round(Math.max(0, ...longTasks)),
  }
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const rows = []
  for (const mode of [
    'A-现状',
    'B-隐藏流线层',
    'C-流线层不动画',
    'D-只保留位移',
    'E-只做透明度脉冲',
    'F-手机档路径减半',
    'G-位移+脉冲(去呼吸)',
  ]) {
    rows.push(await measure(browser, mode))
  }
  await browser.close()

  console.log(`目标：${URL}（390×844，CPU 4× 降速，各采样 3 秒）\n`)
  console.log(
    ['模式', 'FPS', 'p50', 'p95', 'max', '掉帧%', '长任务数', '长任务总时长', '最长任务']
      .map((h, i) => h.padEnd(i === 0 ? 16 : 12))
      .join(''),
  )
  for (const r of rows) {
    console.log(
      [
        r.mode,
        String(r.fps),
        `${r.p50}ms`,
        `${r.p95}ms`,
        `${r.max}ms`,
        `${r.droppedPct}%`,
        String(r.longTaskCount),
        `${r.longTaskTotalMs}ms`,
        `${r.longTaskMaxMs}ms`,
      ]
        .map((v, i) => v.padEnd(i === 0 ? 16 : 12))
        .join(''),
    )
  }

  const base = rows[0]
  const hidden = rows[1]
  const noAnim = rows[2]
  console.log(
    `\n流线层代价（A−B）：长任务 ${base.longTaskTotalMs - hidden.longTaskTotalMs}ms / 掉帧 ${base.droppedPct - hidden.droppedPct} 个百分点`,
  )
  console.log(
    `动画本身代价（A−C）：长任务 ${base.longTaskTotalMs - noAnim.longTaskTotalMs}ms / 掉帧 ${base.droppedPct - noAnim.droppedPct} 个百分点`,
  )
  // 关掉动画后如果仍然掉帧严重，说明瓶颈不在动画，而在别处（渲染量 / JS）
  const verdict =
    base.droppedPct - noAnim.droppedPct >= 20
      ? '流线动画是掉帧主因'
      : hidden.longTaskTotalMs < base.longTaskTotalMs * 0.7
        ? '流线层的**渲染量**（节点数/绘制）是主因，不只是动画'
        : '流线层不是主因，瓶颈在别处'
  console.log(`判定：${verdict}`)

  // ---- 门槛（评审指出第一版只打印不判定，等于没有判据：回归时 21 FPS 也会全绿退出 0）----
  // 门槛取「现状档」（A）在 390×844 + CPU 4× 降速下的实测值留出余量：
  // 修完实测 76 FPS / 掉帧 0% / p95 17ms / 长任务 162ms；坏掉的版本是 21 FPS / 97% / p95 67ms / 310ms。
  const LIMITS = { droppedPct: 20, p95: 45, longTaskTotalMs: 600 }
  const fails = []
  if (base.droppedPct > LIMITS.droppedPct) fails.push(`掉帧率 ${base.droppedPct}% > ${LIMITS.droppedPct}%`)
  if (base.p95 > LIMITS.p95) fails.push(`p95 帧间隔 ${base.p95}ms > ${LIMITS.p95}ms`)
  if (base.longTaskTotalMs > LIMITS.longTaskTotalMs)
    fails.push(`长任务总时长 ${base.longTaskTotalMs}ms > ${LIMITS.longTaskTotalMs}ms`)
  console.log(
    fails.length
      ? `\n✘ 移动端性能门槛未过：\n  - ${fails.join('\n  - ')}`
      : `\n✔ 移动端性能门槛通过（掉帧 ${base.droppedPct}% ≤ ${LIMITS.droppedPct}%、p95 ${base.p95}ms ≤ ${LIMITS.p95}ms、长任务 ${base.longTaskTotalMs}ms ≤ ${LIMITS.longTaskTotalMs}ms）`,
  )
  process.exit(fails.length ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
