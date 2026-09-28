import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** 元素进入视口一次即返回 true（用于触发入场动画）。 */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // 环境不支持（如 jsdom 未 polyfill）时直接视为已可见，保证内容一定有最终值
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, inView }
}

/**
 * 数字滚动。`active` 为 false 时返回终值（不是 0）——避免 SEO / 预渲染阶段拿到 0。
 * `prefers-reduced-motion` 下直接返回终值。
 */
export function useCountUp(target: number, active: boolean, duration = 900): number {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    setValue(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, active, duration])

  return value
}
