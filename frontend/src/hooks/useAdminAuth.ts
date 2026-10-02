import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminLogin, adminLogout, fetchCurrentAdmin } from '@/api/admin'
import { clearToken, getToken, setToken } from '@/api/client'

/**
 * 后台登录态。**真源是 sessionStorage 里的 token**，服务端 `/me` 只用来校验它还有效 ——
 * 所以：
 *  · `enabled: getToken() !== null`：本地压根没凭据时不发那次注定 401 的请求；
 *  · `retry: false`：401 就是 401，重试三次只是让用户多等两秒才看到登录页；
 *  · `/me` 一失败（401）即视为未登录，由 `RequireAdmin` 跳转 —— 不在这里做跳转，
 *    否则 hook 会耦合路由。
 */
export function useAdminAuth() {
  const queryClient = useQueryClient()

  const me = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: fetchCurrentAdmin,
    enabled: getToken() !== null,
    retry: false,
  })

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      adminLogin(username, password),
    onSuccess: (data) => {
      // 先落 token 再写 me：顺序反过来的话，任何一次 me 重取都会因为没 token 而 401
      setToken(data.token)
      queryClient.setQueryData(['admin', 'me'], data.admin)
    },
  })

  const logout = useMutation({
    mutationFn: adminLogout,
    onSuccess: () => {
      clearToken()
      queryClient.removeQueries({ queryKey: ['admin'] })
    },
  })

  return { me, login, logout }
}
