/**
 * AF4：上传原件台账面板（翻译/OCR 工作台共用）。
 * 上传批次目录列表：日期 / 批次名 / 文件数 / 大小 / 来源 / 引用任务（数 + 最新状态）。
 * 行内删除 + 批量删除——仅无任务引用的原件可删；有引用 → 409 提示先删任务。
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, message, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'

const SOURCE_LABEL: Record<string, string> = {
  translate: '翻译工作台', ocr: 'OCR 工作台', unknown: '未记录',
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function UploadsPanel({ title = '已上传原件' }: { title?: string }) {
  const pid = useActivePid()
  const api = apiFor(pid)
  const qc = useQueryClient()
  const [picked, setPicked] = useState<string[]>([])
  const uploads = useQuery({
    queryKey: ['provider', pid, 'uploads'],
    queryFn: () => api.listUploads(),
  })
  const del = useMutation({
    mutationFn: (roots: string[]) => api.deleteUploads(roots),
    onSuccess: (r) => {
      message.success(`已删除 ${r.removed.length} 个原件目录`)
      setPicked([])
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'uploads'] })
    },
    onError: (e: Error) => message.error(e.message),
  })
  const rows = uploads.data?.uploads ?? []
  const cols = useMemo(() => [
    { title: '日期', dataIndex: 'date', width: 100 },
    { title: '批次', dataIndex: 'label', ellipsis: true,
      render: (_: unknown, r: { dir: string; label: string; path: string }) => (
        <Typography.Text title={r.path} ellipsis style={{ maxWidth: 220 }}>{r.label}</Typography.Text>
      ) },
    { title: '文件', dataIndex: 'count', width: 70, render: (n: number) => `${n} 个` },
    { title: '大小', dataIndex: 'size', width: 90, render: (n: number) => humanSize(n) },
    { title: '来源', dataIndex: 'source', width: 110,
      render: (s: string) => <Tag>{SOURCE_LABEL[s] ?? s}</Tag> },
    { title: '引用任务', key: 'runs', width: 130,
      render: (_: unknown, r: { runs: { count: number; latest_status: string | null } }) => (
        r.runs.count
          ? <Tag color={r.runs.latest_status === 'succeeded' ? 'success' : 'processing'}>
              {r.runs.count} 个 · {r.runs.latest_status}
            </Tag>
          : <Tag color="default">无引用</Tag>
      ) },
    { title: '', key: 'op', width: 80,
      render: (_: unknown, r: { dir: string; label: string; runs: { count: number } }) => (
        r.runs.count > 0
          ? <Tooltip title={`仍被 ${r.runs.count} 个任务引用，先在任务清单删除对应任务`}>
              <Button size="small" disabled icon={<DeleteOutlined />} />
            </Tooltip>
          : <Popconfirm title={`删除原件「${r.label}」？`}
              onConfirm={() => del.mutate([r.dir])}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
      ) },
  ], [del])
  return (
    <Card size="small" title={title} styles={{ body: { padding: 0 } }}
      extra={picked.length > 0 ? (
        <Popconfirm title={`批量删除 ${picked.length} 个无引用原件？`}
          onConfirm={() => del.mutate(picked)}>
          <Button size="small" danger icon={<DeleteOutlined />}>批量删除（{picked.length}）</Button>
        </Popconfirm>
      ) : undefined}>
      <Table size="small" rowKey="dir" columns={cols} dataSource={rows}
        loading={uploads.isLoading} pagination={{ pageSize: 10, showSizeChanger: false }}
        rowSelection={{
          selectedRowKeys: picked,
          onChange: (keys) => setPicked(keys as string[]),
          // 有引用的行不可勾选（后端 409 防呆兜底）
          getCheckboxProps: (r: { runs: { count: number } }) => ({ disabled: r.runs.count > 0 }),
        }} />
    </Card>
  )
}
