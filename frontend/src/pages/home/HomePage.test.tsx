import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import HomePage from './HomePage'

describe('HomePage', () => {
  it('渲染姓名与一句话定位', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('庄家希')
    expect(screen.getByText(/AI 应用开发工程师/)).toBeInTheDocument()
  })

  it('三个实习经历都出现在页面上', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/广州视源电子科技股份有限公司/)).toBeInTheDocument()
    expect(screen.getByText(/广东用友网络有限公司/)).toBeInTheDocument()
    expect(screen.getByText(/广东粤建三和软件有限公司/)).toBeInTheDocument()
  })

  it('四个关键数字都有标签与出处', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 用 getAllByText：指标标签可能同时出现在项目卡的正文中（如「知识库检索准确率」）
    const labels = ['接口响应下降', '知识库检索准确率', '慢查询耗时', '异常订单自动修复率']
    labels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('简历下载入口指向 /resume.pdf', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '下载简历 PDF' })
    expect(link).toHaveAttribute('href', '/resume.pdf')
  })
})
