import { ApiError } from '@/api/client'

/**
 * 把一次取数失败翻译成**一句人话**。
 *
 * 页面之前是这么写的：「后端没起来或是接口出错 —— 这里不会拿假数据凑数。」
 * 问题不在语气，在**说话的对象搞错了**：那是写给代码评审看的一句话
 * （「不做假数据降级」是 `Agent.md` 里的工程约束），却被摆到了访客面前。
 * 访客不知道什么叫后端、也不关心你有没有拿假数据兜底，他只知道「这里空了」。
 *
 * 三条纪律：
 * 1. **不端原始英文**：断网时浏览器抛的是 `TypeError: Failed to fetch`，
 *    原样印在页面上比不写还糟；
 * 2. **不解释实现**：只说发生了什么、他能不能再试一次。谁没起来是运维的事；
 * 3. **仍然给原因**：`openspec` 的「三种状态可区分」要求错误态带失败原因，
 *    所以保留 HTTP 状态这类能读的说法，只是把它说成人话。
 */
export function describeLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    // 5xx 归服务端。后端那句 message 此时常常是空的或英文的兜底文案，统一换成站点口吻
    if (error.httpStatus >= 500) {
      return `服务没响应（HTTP ${error.httpStatus}）`
    }
    // 4xx，以及「HTTP 200 + 业务错误码」两种，message 都是后端写给人看的（「文章不存在」），直接用
    return error.message
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '请求被中断了'
  }
  if (error instanceof TypeError) {
    // fetch 在网络层失败时抛的就是 TypeError
    return '网络好像不通'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '原因不明'
}
