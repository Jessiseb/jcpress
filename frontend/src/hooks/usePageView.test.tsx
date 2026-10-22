import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeVisitPath, usePageView } from './usePageView'

const reportPageView = vi.fn()
vi.mock('@/api/stats', () => ({
  reportPageView: (...args: unknown[]) => reportPageView(...args),
}))

/** 只为了在路由上下文里跑一次 effect */
function Probe() {
  usePageView()
  return <p>probe</p>
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  )

describe('normalizeVisitPath', () => {
  it('剥掉 query 与 hash', () => {
    expect(normalizeVisitPath('/tech?tag=java#top')).toBe('/tech')
    expect(normalizeVisitPath('/tech#section')).toBe('/tech')
  })

  it('去掉末尾斜杠但保住根路径', () => {
    expect(normalizeVisitPath('/tech/')).toBe('/tech')
    expect(normalizeVisitPath('/')).toBe('/')
  })

  it('后台路径与非法路径都不上报', () => {
    expect(normalizeVisitPath('/admin')).toBeNull()
    expect(normalizeVisitPath('/admin/dashboard')).toBeNull()
    expect(normalizeVisitPath('tech')).toBeNull()
    expect(normalizeVisitPath('')).toBeNull()
  })
})

describe('usePageView', () => {
  beforeEach(() => {
    // 必须用大括号：箭头简写会把 mock 当返回值，vitest 会把它当 teardown 再调一次
    reportPageView.mockReset()
  })

  it('前台路由落定后上报一次', () => {
    renderAt('/tech/redis-lettuce')
    expect(reportPageView).toHaveBeenCalledTimes(1)
    expect(reportPageView).toHaveBeenCalledWith('/tech/redis-lettuce')
  })

  it('后台路由不上报', () => {
    renderAt('/admin/dashboard')
    expect(reportPageView).not.toHaveBeenCalled()
  })
})
