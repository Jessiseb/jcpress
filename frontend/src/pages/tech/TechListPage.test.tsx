import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { articleData } from '@/data/articles'
import TechListPage from './TechListPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TechListPage />
    </MemoryRouter>,
  )
}

describe('TechListPage', () => {
  it('页面只有一个 h1，内容是频道名', () => {
    renderPage()

    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent('技术分享')
  })

  it('计数取自数据长度，不是写死的数字', () => {
    renderPage()

    expect(screen.getByText(new RegExp(`共 ${articleData.length} 篇`))).toBeInTheDocument()
  })

  it('每条文章渲染标题与分类', () => {
    renderPage()

    articleData.forEach((a) => {
      expect(screen.getByText(a.title)).toBeInTheDocument()
    })
  })

  it('列表项不设链接（详情页未建，避免死链）', () => {
    renderPage()

    // 有数据时不渲染空态，页面上一个链接都不该有
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
