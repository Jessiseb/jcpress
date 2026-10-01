import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, clearToken, getToken, request, setToken } from './client'

describe('api client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  // 每次调用都要**新建**一个 Response：Response 的 body 只能读一次，
  // 复用同一个实例时第二次读到空 body，会误落到「非 JSON 响应」分支（踩过）
  const mockFetch = (body: unknown, status = 200) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

  it('unwraps the envelope and returns data', async () => {
    mockFetch({ code: 0, message: 'ok', data: { slug: 'a' }, traceId: 't1' })

    await expect(request<{ slug: string }>('/api/v1/articles/a')).resolves.toEqual({ slug: 'a' })
  })

  it('throws ApiError carrying both business code and http status', async () => {
    mockFetch({ code: 40401, message: '文章不存在', data: null, traceId: 't2' }, 404)

    const error = await request('/api/v1/articles/nope').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe(40401)
    expect((error as ApiError).httpStatus).toBe(404)
    expect((error as ApiError).message).toBe('文章不存在')
  })

  it('sends the token header only when auth is requested', async () => {
    const spy = mockFetch({ code: 0, message: 'ok', data: null, traceId: null })
    setToken('token-abc')

    await request('/api/v1/admin/articles', { auth: true })
    const authHeaders = new Headers((spy.mock.calls[0][1] as RequestInit).headers)
    expect(authHeaders.get('jcpress-token')).toBe('token-abc')

    spy.mockClear()
    await request('/api/v1/articles')
    const plainHeaders = new Headers((spy.mock.calls[0][1] as RequestInit).headers)
    expect(plainHeaders.get('jcpress-token')).toBeNull()
  })

  it('clears the token when the backend reports an auth failure', async () => {
    setToken('stale-token')
    mockFetch({ code: 40102, message: 'token 过期或无效', data: null, traceId: null }, 401)

    await expect(request('/api/v1/admin/auth/me', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })

  it('refuses to send an authenticated request without a local token', async () => {
    clearToken()

    await expect(request('/api/v1/admin/auth/me', { auth: true })).rejects.toMatchObject({
      code: 40101,
    })
  })

  it('appends only non-empty query params', async () => {
    const spy = mockFetch({ code: 0, message: 'ok', data: null, traceId: null })

    await request('/api/v1/articles', {
      query: { type: 'TECH', page: 1, categoryId: undefined, tagSlug: '' },
    })

    const url = new URL((spy.mock.calls[0][0] as URL).toString())
    expect(url.searchParams.get('type')).toBe('TECH')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.has('categoryId')).toBe(false)
    expect(url.searchParams.has('tagSlug')).toBe(false)
  })

  it('reports a non-JSON response as an ApiError instead of pretending success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    )

    const error = await request('/api/v1/articles').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).httpStatus).toBe(502)
  })
})
