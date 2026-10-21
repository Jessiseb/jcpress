import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import HomePage from './HomePage'

/**
 * 三期给首页加了「最新技术分享」区块，它内部走 react-query。
 * 不挂 Provider 会让**整页**在渲染时抛 `No QueryClient set`，11 条用例一起红 ——
 * 报错发生在子组件里，看不出和首页有什么关系，所以这里挂上 Provider 并给接口一个空结果。
 */
vi.mock('@/api/articles', () => ({
  fetchArticles: vi.fn().mockResolvedValue({ list: [], page: 1, size: 3, total: 0, pages: 0 }),
}))

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
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

  it('三段实习经历同时铺开，不需要点击切换', () => {
    renderHome()

    const section = sectionOf('实习经历')
    const names = ['广州视源电子科技股份有限公司', '广东用友网络有限公司', '广东粤建三和软件有限公司']

    // 竖向时间轴：三段正文都在 DOM 里（旧版是一次只展开一段的切换器）
    names.forEach((name) => {
      expect(
        within(section).getByRole('heading', { level: 3, name: new RegExp(name) }),
      ).toBeInTheDocument()
    })
    expect(within(section).queryAllByRole('tab')).toHaveLength(0)
    expect(section.querySelectorAll('ol > li')).toHaveLength(3)
  })

  it('每段默认露出 3 条要点，其余折叠进 details', () => {
    renderHome()

    const first = sectionOf('实习经历').querySelector('ol > li') as HTMLElement
    const lists = first.querySelectorAll('ul')

    // CVTE 那段共 7 条：可见 3 条，折叠 4 条
    expect(lists[0].querySelectorAll('li')).toHaveLength(3)
    expect(lists[1].querySelectorAll('li')).toHaveLength(4)

    const details = first.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')).toHaveTextContent('展开其余 4 条')
  })

  it('要点只比阈值多 1 条时不折叠——藏一条却要多点一次，是负收益', () => {
    renderHome()

    // 用友那段共 4 条：剩 1 条，直接全露，不出 details
    const items = sectionOf('实习经历').querySelectorAll('ol > li')
    const yonyou = items[1] as HTMLElement

    expect(yonyou.querySelectorAll('details')).toHaveLength(0)
    expect(yonyou.querySelectorAll('ul li')).toHaveLength(4)
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
