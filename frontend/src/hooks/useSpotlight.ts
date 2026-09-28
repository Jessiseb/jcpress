import { useEffect, useRef } from 'react'

/**
 * 指针跟随的聚光（移植自 spotlight-card，改用 CSS 变量 + CSS Modules 实现）。
 *
 * 做法：把指针在**元素内**的相对坐标写进 `--spot-x` / `--spot-y`，CSS 用它定位一枚径向渐变。
 *
 * 与原始实现的四处差异（都是为了在这个项目里成立，不是为了省事）：
 *  1. 监听**元素自己**的 pointermove，而不是 `document` —— 原实现让全局每个元素的每次移动
 *     都去写 four 个 CSS 变量，页面上一堆卡片时是纯粹的浪费；
 *  2. 用**元素相对坐标**，不用视口坐标 + `background-attachment: fixed` —— fixed 在滚动与
 *     transform 下会漂，而且每帧全视口重绘；
 *  3. 只在 `(hover: hover)` 且未开启「减少动态效果」时绑定 —— 触摸设备没有悬浮态；
 *  4. 进入/离开只切一个 `data-spotlight` 属性，渐变与过渡全部交给 CSS。
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    if (typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(hover: hover)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--spot-x', `${(event.clientX - rect.left).toFixed(1)}px`)
      el.style.setProperty('--spot-y', `${(event.clientY - rect.top).toFixed(1)}px`)
    }
    const onEnter = () => el.setAttribute('data-spotlight', 'on')
    const onLeave = () => el.removeAttribute('data-spotlight')

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      el.removeAttribute('data-spotlight')
    }
  }, [])

  return ref
}
