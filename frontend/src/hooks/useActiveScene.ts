import { useEffect, useState } from 'react'

/**
 * 当前「场景」（区块）序号 —— 供天体做**分节停靠**用。
 *
 * 参照组件的 ScrollGlobe 是这么做的：滚动时算出离视口中心最近的那一节，
 * 把球滑到那一节对应的位置（`translate3d(75vw,50vh) scale(1.4)` → 下一节另一个位置），
 * 由 CSS transition（1400ms / cubic-bezier(.23,1,.32,1)）负责「滑」的过程。
 *
 * ## 两条与参照组件的刻意偏离
 *
 * 1. **不用 scroll 监听**：本站全站唯一的滚动监听在 `useScrollProgress` 里（它写 `--scroll-p`）。
 *    这里用 IntersectionObserver —— 和 `useReveal` 同一套机制，不新增滚动回调。
 *
 * 2. **用「视口中线一条窄带」判定，而不是「21 档 threshold 取可见比例最大」**。
 *    第一版是 21 档 threshold 取可见比例最大的那个，逻辑上更严谨（能正确处理高度差很大的区块），
 *    但每个渲染帧都要重算 7 个目标的交点比例并与 21 档逐一比较。现在只观察「跨过视口中线」
 *    这一个事件，全程约 14 次回调 —— 高度不同的区块同样能正确处理，因为带子只有 10% 高，
 *    任何时刻最多一两个区块压在它上面。
 *    （顺带记一条**测量纪律**：我一度以为这个 hook 造成了移动端掉帧，但那是 `audit-perf.cjs`
 *    A 档的噪声 —— 它测的是「load 后立刻采样 3 秒」，同一份构建连跑四次的读数是
 *    60% / 67% / 33% / 13%。换成「等 2.5 秒让加载期落定再采样」之后，挂与不挂天体都是
 *    60 FPS / 0% 掉帧。见 docs/decisions.md #81。）
 *
 * 另外用 `setIndex(prev => …)` 做**同值短路**：observer 在外面滚一个来回会触发多次回调，
 * 值没变时不该惊动 React（同值虽然会被 bail out，但仍会走一次调度）。
 */
export function useActiveScene(selector = 'main section[aria-labelledby]') {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const targets = Array.from(document.querySelectorAll(selector))
    if (targets.length === 0) return

    const inBand = new Map<Element, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => inBand.set(entry.target, entry.isIntersecting))
        // 取 DOM 顺序里第一个「压在视口中线上」的区块
        let best = -1
        targets.forEach((el, i) => {
          if (best < 0 && inBand.get(el)) best = i
        })
        if (best < 0) return
        setIndex((prev) => (prev === best ? prev : best))
      },
      // 视口中线上下各 5% 的一条带：区块跨过它 = 成为当前场景
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [selector])

  return index
}
