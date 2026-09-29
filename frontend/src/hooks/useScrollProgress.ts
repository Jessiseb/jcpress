import { useEffect } from 'react'

/**
 * 滚动进度（二期 phase-2-visual）。
 *
 * 设计要点：**全站只有一个滚动监听、一个 rAF**，结果写成 `<html>` 上的 `--scroll-p`（0–1）。
 * 消费方（顶部的进度条、装饰层视差）只读这个变量，因此：
 *  · 所有滚动联动的取值都来自同一个数，不会出现两个监听互相漂移；
 *  · 「剂量上限」只需要在一处保证（见 theme.jcpress.css 的 --ds-parallax-* 与 spec）。
 *
 * 为什么不用 IntersectionObserver 逐段驱动：做不出「连续进度条」。
 * 为什么不用动效库的 useScroll：本期的实现路线是零依赖优先（决策 #49），
 * 引入 motion 只在验收不达标时另开 change。
 *
 * 三条纪律：
 *  1. `{ passive: true }`：滚动监听不阻塞主线程；
 *  2. rAF 节流：一帧最多写一次，避免连续 scroll 事件里反复改样式；
 *  3. **不因 reduced-motion 而停止更新** —— 进度条是「信息的呈现」，不是装饰动效
 *     （site-shell 的「减少动态效果降级」要求它在降级下仍然可见并反映进度）；
 *     视差的静止是在 CSS 里做的（`data-parallax` 层在 reduced-motion 下 transform: none）。
 */
export function useScrollProgress() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let frame = 0

    const write = () => {
      frame = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0
      // 三位小数：够平滑，也不会让样式字符串无意义地变长
      doc.style.setProperty('--scroll-p', progress.toFixed(3))
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(write)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    write()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
      document.documentElement.style.removeProperty('--scroll-p')
    }
  }, [])
}
