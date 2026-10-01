import { useQuery } from '@tanstack/react-query'

import { fetchArticleDetail } from '@/api/articles'

export function useArticleDetail(slug: string) {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: () => fetchArticleDetail(slug),
    enabled: slug.length > 0,
  })
}
