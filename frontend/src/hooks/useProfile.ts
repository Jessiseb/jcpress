import { profileData, type ProfileAggregateVO } from '@/data/profile'

/**
 * 首页聚合数据的唯一读取入口。
 *
 * 后端 `/api/v1/profile`（规划 §9.2）就绪后，把这里换成：
 *
 *   export function useProfile() {
 *     return useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
 *   }
 *
 * 组件侧不需要任何改动 —— 这是把数据放在常量里的全部理由。
 */
export function useProfile(): ProfileAggregateVO {
  return profileData
}
