/**
 * 工具分类目录 hook：总类→子类两级由 CommAND /api/meta/tool-categories 下发。
 * staleTime Infinity（分类运行期不变）+ 内置回落（与 CommAND core/tool_categories 同步维护）。
 */

import { useQuery } from '@tanstack/react-query'
import { apiFor } from '@/api/client'
import type { ToolCategoryInfo } from '@/api/types'
import { useActivePid } from '@/transfer/context'

export const FALLBACK_CATEGORIES: ToolCategoryInfo[] = [
  { name: '文档处理', subs: ['PDF', 'Word', '纯文本', '表格', '版面', 'Excel'] },
  { name: '图像影像', subs: ['图像'] },
  { name: '识别与结果', subs: ['识别结果库', '记录'] },
  { name: '模板引擎', subs: ['模板'] },
  { name: '翻译文本', subs: ['文本'] },
  { name: '开发调试', subs: ['开发'] },
]

export function useToolCategoryCatalog() {
  const pid = useActivePid()
  const { data } = useQuery({
    queryKey: ['provider', pid, 'meta', 'tool-categories'],
    queryFn: apiFor(pid).getToolCategories,
    staleTime: Infinity,
    retry: 1,
  })
  const categories = data?.categories?.length ? data.categories : FALLBACK_CATEGORIES
  return { categories }
}
