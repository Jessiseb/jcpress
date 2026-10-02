import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * 编排式入场序列。
 *
 * 把返回的 ref 挂到页面根节点上，节点内所有带 `data-reveal` 的元素会在进入视口时
 * 依次浮现（错峰间隔由元素上的 `--reveal-delay` 内联变量控制，60–120ms 一档）。
 *
 * 三条硬约束：
 *  1. 隐藏态由 `<html data-reveal-armed="on">` 门控 —— JS 没跑起来时正文永远可见，
 *     不拿 SEO / 预渲染产物换动效。global.css 里的选择器依赖这个属性。
 *     ⚠️ 门控属性与内容标记 `data-reveal` **必须是两个不同的名字**：若共用，
 *     给 `<html>` 打的开关会自匹配成一个待入场元素（详见 global.css 的注释）。
 *  2. `prefers-reduced-motion: reduce` 下直接不接管，元素保持静态。
 *  3. 环境没有 IntersectionObserver（如 jsdom 未 polyfill）时同样不接管。
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  // 用 layout effect 在第一帧绘制前打标记，避免「先显示 → 再隐藏 → 再浮现」的闪动。
  // SSR / 预渲染环境没有 window，退回 useEffect 以免 React 抛警告。
  const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

  useIsomorphicLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof window === 'undefined') return

    // 先判 IntersectionObserver：jsdom 没有它，直接放行。
    // 顺序不能反 —— matchMedia 在部分测试环境里也不存在，先问它会抛错。
    if (typeof IntersectionObserver === 'undefined') return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const html = document.documentElement
    html.setAttribute('data-reveal-armed', 'on')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        })
      },
      // 底部留 12% 提前量：元素还没贴到视口底边就开始浮现，滚动时不会「追着跑」
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    const seen = new WeakSet<Element>()
    const observeAll = () => {
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((item) => {
        if (seen.has(item)) return
        seen.add(item)
        observer.observe(item)
      })
    }
    observeAll()

    /**
     * 三期的「最新技术分享」区块是靠接口异步取数据的，它的行（`li`）在 `useReveal` 挂载
     * **之后**才渲染出来 —— 只在挂载时扫一次会漏掉它们，那些行会一直停在隐藏态
     * （`html[data-reveal-armed="on"]` 的 CSS 把它们压成透明），表现为「首页最后一行文字不出现」。
     * 用 MutationObserver 把后来插入的 `[data-reveal]` 节点补进观察集合。
     */
    const mutation = new MutationObserver(() => observeAll())
    mutation.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutation.disconnect()
      html.removeAttribute('data-reveal-armed')
    }
  }, [])

  return ref
}
