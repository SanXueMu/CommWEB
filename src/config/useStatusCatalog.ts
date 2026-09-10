/**
 * 状态目录 hook：分组/终态语义由 CommAND /api/meta/statuses 下发（调度器是唯一事实源）。
 * 性能护栏：staleTime Infinity（状态机运行期不变）+ 内置回落（API 未达时不阻塞渲染）。
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { StatusInfo } from '@/api/types'
import { useActivePid } from '@/transfer/context'

export const FALLBACK_STATUSES: StatusInfo[] = [
  { value: 'queued', label: '排队中', group: 'active', terminal: false },
  { value: 'running', label: '运行中', group: 'active', terminal: false },
  { value: 'succeeded', label: '成功', group: 'succeeded', terminal: true },
  { value: 'failed', label: '失败', group: 'failed', terminal: true },
  { value: 'failed_review', label: '待复核', group: 'failed', terminal: true },
  { value: 'cancelled', label: '已取消', group: 'cancelled', terminal: true },
  { value: 'interrupted', label: '已中断', group: 'cancelled', terminal: true },
]

export function useStatusCatalog() {
  const pid = useActivePid()
  const { data } = useQuery({
    queryKey: ['provider', pid, 'meta', 'statuses'],
    queryFn: api.getStatuses,
    staleTime: Infinity,
    retry: 1,
  })
  const statuses = data?.statuses?.length ? data.statuses : FALLBACK_STATUSES
  const byValue = new Map(statuses.map((s) => [s.value, s]))
  const byGroup = statuses.reduce<Record<string, StatusInfo[]>>((acc, s) => {
    ;(acc[s.group] ??= []).push(s)
    return acc
  }, {})
  return { statuses, byValue, byGroup }
}
