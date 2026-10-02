import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminArticleVO } from '@/api/types'
import AdminArticleEditPage from './AdminArticleEditPage'

/** CodeMirror 在 jsdom 里跑不起来（要真实测量与 rAF）；用受控 textarea 顶替，
 *  只保留「value / onChange」这个对被测页面真正重要的契约。 */
vi.mock('@/components/admin/MarkdownEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea
      aria-label="正文编辑器"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

const fetchAdminArticle = vi.fn()
const updateAdminArticle = vi.fn()
const saveAdminArticle = vi.fn()
vi.mock('@/api/admin', () => ({
  fetchAdminArticle: (...args: unknown[]) => fetchAdminArticle(...args),
  updateAdminArticle: (...args: unknown[]) => updateAdminArticle(...args),
  saveAdminArticle: (...args: unknown[]) => saveAdminArticle(...args),
  fetchAdminArticles: vi.fn().mockResolvedValue({ list: [], page: 1, size: 50, total: 0, pages: 0 }),
  publishAdminArticle: vi.fn(),
  deleteAdminArticle: vi.fn(),
}))

const fetchCategories = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchCategories: (...args: unknown[]) => fetchCategories(...args),
}))

// 编辑页只用到 token 存在性（AdminLayout 里读一次）；给个真值免得顶栏分支报错
vi.mock('@/api/client', () => ({
  getToken: () => 'test-token',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

const article: AdminArticleVO = {
  id: '42',
  title: '原题',
  slug: 'original-slug',
  summary: '摘要',
  coverUrl: null,
  categoryId: '7',
  categoryName: 'Java 后端',
  tags: ['Redis'],
  status: 0,
  wordCount: 120,
  readingMinutes: 3,
  viewCount: 0,
  top: 0,
  publishTime: null,
  gmtModified: '2026-10-02 10:00:00',
  contentMd: '正文',
}

const renderEdit = (id = '42') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/admin/articles/${id}`]}>
        <Routes>
          <Route path="/admin/articles/:id" element={<AdminArticleEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('AdminArticleEditPage', () => {
  beforeEach(() => {
    fetchAdminArticle.mockReset().mockResolvedValue(article)
    updateAdminArticle.mockReset().mockResolvedValue(undefined)
    saveAdminArticle.mockReset().mockResolvedValue('99')
    fetchCategories.mockReset().mockResolvedValue([
      { id: '7', name: 'Java 后端', slug: 'java-backend', description: null, articleCount: 3 },
    ])
  })

  it('中文标题 + 空 slug → 提交前拦下并给出提示，且不发保存请求', async () => {
    renderEdit()

    const title = await screen.findByLabelText('标题')
    const slug = screen.getByLabelText(/slug/)
    fireEvent.change(title, { target: { value: '一篇中文标题' } })
    fireEvent.change(slug, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    expect(await screen.findByText(/中文标题请手填/)).toBeInTheDocument()
    expect(updateAdminArticle).not.toHaveBeenCalled()
  })

  it('保存草稿调用 updateAdminArticle 且带上 id 与 status=0', async () => {
    renderEdit()

    const title = await screen.findByLabelText('标题')
    fireEvent.change(title, { target: { value: '改过的标题' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => expect(updateAdminArticle).toHaveBeenCalledTimes(1))
    const [id, payload] = updateAdminArticle.mock.calls[0]
    expect(id).toBe('42')
    expect(payload).toMatchObject({ title: '改过的标题', status: 0, categoryId: '7' })
  })
})
