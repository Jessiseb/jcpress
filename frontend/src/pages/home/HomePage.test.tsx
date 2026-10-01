import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import HomePage from './HomePage'

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

/** 取某个区块标题所在的 <section>，用于把断言限制在单个区块内。 */
function sectionOf(title: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section')
  if (!section) throw new Error(`未找到区块：${title}`)
  return section as HTMLElement
}

describe('HomePage', () => {
  it('渲染姓名与一句话定位', () => {
    renderHome()

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('庄家希')
    // 定位行现在是 h1 的第二行，断言限定在 h1 内，避免与别处同名文字撞车
    expect(within(h1).getByText('AI 应用开发工程师')).toBeInTheDocument()
  })

  it('三段实习经历都在切换条里，且当前一段的正文可见', () => {
    renderHome()

    // r3 起实习经历是「一次只展开一段」的切换器，三段全名挂在 tab 的可访问名上
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)

    const names = ['广州视源电子科技股份有限公司', '广东用友网络有限公司', '广东粤建三和软件有限公司']
    names.forEach((name) => {
      expect(screen.getByRole('tab', { name: new RegExp(name) })).toBeInTheDocument()
    })

    // 默认展开第一段：它的公司全名同时出现在正文标题里
    // （h3 里带简称后缀「（CVTE）」，所以用正则而不是精确名）
    const section = sectionOf('实习经历')
    expect(
      within(section).getByRole('heading', { level: 3, name: new RegExp(names[0]) }),
    ).toBeInTheDocument()
  })

  it('点击切换条能换到另一段实习经历', () => {
    renderHome()

    const target = screen.getByRole('tab', { name: /广东用友网络有限公司/ })
    fireEvent.click(target)

    expect(target).toHaveAttribute('aria-selected', 'true')
    const section = sectionOf('实习经历')
    expect(within(section).getByRole('heading', { level: 3, name: '广东用友网络有限公司' })).toBeInTheDocument()
  })

  it('四个关键数字都有标签与出处', () => {
    renderHome()

    // 用 getAllByText：指标标签可能同时出现在项目卡的正文中（如「知识库检索准确率」）
    const labels = ['接口响应下降', '知识库检索准确率', '慢查询耗时', '异常订单自动修复率']
    labels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('简历下载入口指向 /resume.pdf', () => {
    renderHome()

    const link = screen.getByRole('link', { name: '下载简历 PDF' })
    expect(link).toHaveAttribute('href', '/resume.pdf')
  })

  it('全页只有一个 h1，六个区块标题都在 h2 层级', () => {
    renderHome()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const titles = ['拿得出手的数字', '技术栈', '实习经历', '项目经历', '教育与荣誉', '联系我']
    titles.forEach((title) => {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    })
  })

  // 以下四条是针对「AI 味」元素的回归护栏：
  // 这些元素一旦被重新引入，视觉上很隐蔽，但测试会立刻亮红。
  it('关键数字是定义列表，不是超大数字卡片', () => {
    renderHome()

    expect(within(sectionOf('拿得出手的数字')).getAllByRole('term')).toHaveLength(4)
  })

  it('首屏没有按钮，次级动作降级为链接', () => {
    renderHome()

    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement
    expect(within(hero).queryAllByRole('button')).toHaveLength(0)
    expect(within(hero).getAllByRole('link')).toHaveLength(2)
  })

  it('技术栈不再有点阵熟练度条', () => {
    renderHome()

    const skills = within(sectionOf('技术栈'))
    expect(skills.queryByLabelText(/熟练度/)).toBeNull()
    expect(skills.getAllByText('熟悉').length).toBeGreaterThan(0)
  })

  it('项目以表格呈现：三个项目名都在 h3，状态是纯文字', () => {
    renderHome()

    const projects = within(sectionOf('项目经历'))
    expect(projects.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(projects.getAllByText(/已上线/).length).toBeGreaterThan(0)
  })

  it('项目面板默认收起，展开按钮带 aria-expanded 与 aria-controls', () => {
    renderHome()

    const projects = within(sectionOf('项目经历'))
    const toggles = projects.getAllByRole('button', { name: '展开' })
    expect(toggles).toHaveLength(3)

    toggles.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded', 'false')
      const panelId = btn.getAttribute('aria-controls')
      expect(panelId).toBeTruthy()
      expect(document.getElementById(panelId as string)).not.toBeNull()
    })
  })
})
