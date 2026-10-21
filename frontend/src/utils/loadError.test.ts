import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import { describeLoadError } from './loadError'

/**
 * 这些用例守的是「页面上不出现写给开发者看的话」这条底线。
 * 背景：错误态曾经显示「后端没起来或是接口出错 —— 这里不会拿假数据凑数。」，
 * 把 `Agent.md` 里的工程约束摆到了访客眼前（2026-10-21 用户指出）。
 */
describe('describeLoadError', () => {
  it('5xx 归服务端：换成站点口吻，保留 HTTP 状态', () => {
    expect(describeLoadError(new ApiError(50000, '系统内部错误', 502))).toBe('服务没响应（HTTP 502）')
  })

  it('4xx 与业务错误码：后端那句话本来就是写给人看的，直接用', () => {
    expect(describeLoadError(new ApiError(40401, '文章不存在', 404))).toBe('文章不存在')
    // HTTP 200 信封里的业务错误（code != 0）也走这条
    expect(describeLoadError(new ApiError(40101, '未登录', 200))).toBe('未登录')
  })

  it('断网：fetch 抛的 TypeError 不能原样端给访客', () => {
    expect(describeLoadError(new TypeError('Failed to fetch'))).toBe('网络好像不通')
  })

  it('请求被取消', () => {
    expect(describeLoadError(new DOMException('aborted', 'AbortError'))).toBe('请求被中断了')
  })

  it('其余 Error 保留它自己的说法（通常是后端或上层写好的中文）', () => {
    expect(describeLoadError(new Error('后端没起来'))).toBe('后端没起来')
  })

  it('完全不明的东西也要有个说法，不能印 undefined', () => {
    expect(describeLoadError(null)).toBe('原因不明')
    expect(describeLoadError(undefined)).toBe('原因不明')
    expect(describeLoadError('boom')).toBe('原因不明')
  })
})
