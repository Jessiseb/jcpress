import { useQuery } from '@tanstack/react-query'

import { fetchCategories } from '@/api/articles'

export function useCategories(scope = 'TECH') {
  return useQuery({
    queryKey: ['categories', scope],
    queryFn: () => fetchCategories(scope),
  })
}
