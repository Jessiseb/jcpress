import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  it('未激活时直接返回终值 —— 预渲染 / 爬虫拿到的是真实数字而不是 0', () => {
    const { result } = renderHook(() => useCountUp(85, false))
    expect(result.current).toBe(85)
  })

  it('激活且无动画偏好时也返回数字（终值可达）', () => {
    const { result } = renderHook(() => useCountUp(100, true))
    expect(typeof result.current).toBe('number')
    expect(result.current).toBeGreaterThanOrEqual(0)
    expect(result.current).toBeLessThanOrEqual(100)
  })
})
