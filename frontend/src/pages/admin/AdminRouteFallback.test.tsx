import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AdminRouteFallback from './AdminRouteFallback'

/**
 * 这个兜底原本是一行 `<p>正在加载…</p>`，刷新时先看到白底一行字、再看到外壳整体长出。
 * 改成骨架后有两个风险必须由测试盯住：
 *  · 骨架里混进 `<header>` / `<footer>` / `<table>` —— 视觉隔离审计靠这几个标签判断
 *    「后台是不是被弹到登录页」，混进去会让审计误判；
 *  · 骨架只有内容、没有外壳（侧栏 / 顶栏）—— 那样换壳时照样跳版，等于白改。
 */
describe('AdminRouteFallback', () => {
  it('画出外壳骨架，且不出现 header / footer / table', () => {
    const { container } = render(<AdminRouteFallback />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
    expect(container.querySelector('table')).toBeNull()

    // 侧栏在，且里面有占位条（说明不是一片空白）
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside?.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3)
  })

  it('屏幕阅读器听到的是「正在加载后台」，不是一堆空 div', () => {
    render(<AdminRouteFallback />)
    expect(screen.getByRole('status')).toHaveTextContent('正在加载后台')
  })
})
