import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * 编排式入场序列。
 *
 * 把返回的 ref 挂到页面根节点上，节点内所有带 `data-reveal` 的元素会在进入视口时
 * 依次浮现（错峰间隔由元素上的 `--reveal-delay` 内联变量控制，60–120ms 一档）。
 *
 * 三条硬约束：
 *  1. 隐藏态由 `<html data-reveal="on">` 门控 —— JS 没跑起来时正文永远可见，
 *     不拿 SEO / 预渲染产物换动效。global.css 里的选择器依赖这个属性。
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

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (items.length === 0) return

    const html = document.documentElement
    html.setAttribute('data-reveal', 'on')

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

    items.forEach((item) => observer.observe(item))

    return () => {
      observer.disconnect()
      html.removeAttribute('data-reveal')
    }
  }, [])

  return ref
}
