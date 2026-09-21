/**
 * AF4：上传原件台账面板（翻译/OCR 工作台共用）。
 * 上传批次目录列表：日期 / 批次名 / 文件数 / 大小 / 来源 / 引用任务（数 + 最新状态）。
 * 行内删除 + 批量删除——仅无任务引用的原件可删；有引用 → 409 提示先删任务。
 *
 * AN（2026-09-20）：目录行可**展开** → 勾选目录下文件 → 「用所选发起识别」——
 * 免重新上传即可对已上传过的原件重跑（onUseFiles 回调注入；不传则不显示复用入口）。
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, message, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, DownOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons'
import { SimplePager } from '@/components/ui/SimplePager'
import { apiFor, type UploadFileItem } from '@/api/client'
import { useActivePid } from '@/transfer/context'
import { humanSize } from '@/lib/size'

const SOURCE_LABEL: Record<string, string> = {
  translate: '翻译工作台', ocr: 'OCR 工作台', unknown: '未记录',
}

interface UploadRow {
  dir: string; date: string; label: string; path: string; count: number; size: number
  source: string; batch_id?: string; runs: { count: number; latest_status: string | null }
}

export function UploadsPanel({ title = '已上传原件', extensions, onUseFiles, useLabel = '发起识别', defaultCollapsed = false }: {
  title?: string
  /** 可复用后缀（如 ['.pdf', '.png']）：不在列表内的文件禁选并提示；不传则全可选 */
  extensions?: string[]
  /** 复用回调：把所选文件的绝对路径交给工作台（走现有批量入队管线） */
  onUseFiles?: (paths: string[]) => void
  useLabel?: string
  /** UI 原则①：面板默认收纳（标题行展开/收起），避免批量模式整屏被占 */
  defaultCollapsed?: boolean
}) {
  const pid = useActivePid()
  const api = apiFor(pid)
  const qc = useQueryClient()
  const [picked, setPicked] = useState<string[]>([])
  // AN：展开行缓存（dir → 文件明细）与文件级勾选（绝对路径）
  const [expanded, setExpanded] = useState<string[]>([])
  const [filesByDir, setFilesByDir] = useState<Record<string, UploadFileItem[]>>({})
  const [loadingDir, setLoadingDir] = useState<string | null>(null)
  const [fileSel, setFileSel] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [filePage, setFilePage] = useState<Record<string, number>>({})
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
  const rows = (uploads.data?.uploads ?? []) as UploadRow[]

  const supported = (name: string) =>
    !extensions?.length || extensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()))

  const loadFiles = async (dir: string) => {
    setLoadingDir(dir)
    try {
      const out = await api.listUploadFiles(dir)
      setFilesByDir((prev) => ({ ...prev, [dir]: out.files }))
    } catch (e) {
      message.error(`读取目录文件失败：${(e as Error).message}`)
    } finally {
      setLoadingDir(null)
    }
  }

  const toggleDir = (dir: string, expand: boolean) => {
    setExpanded((prev) => (expand ? [...prev, dir] : prev.filter((d) => d !== dir)))
    if (expand && !filesByDir[dir]) void loadFiles(dir)
  }

  const toggleFile = (path: string, checked: boolean) => {
    setFileSel((prev) => (checked ? [...prev, path] : prev.filter((p) => p !== path)))
  }

  const cols = useMemo(() => [
    { title: '日期', dataIndex: 'date', width: 100 },
    { title: '批次', dataIndex: 'label', ellipsis: true,
      render: (_: unknown, r: UploadRow) => (
        <Typography.Text title={r.path} ellipsis style={{ maxWidth: 220 }}>{r.label}</Typography.Text>
      ) },
    { title: '文件', dataIndex: 'count', width: 70, render: (n: number) => `${n} 个` },
    { title: '大小', dataIndex: 'size', width: 90, render: (n: number) => humanSize(n) },
    { title: '来源', dataIndex: 'source', width: 110,
      render: (s: string) => <Tag>{SOURCE_LABEL[s] ?? s}</Tag> },
    { title: '引用任务', key: 'runs', width: 130,
      render: (_: unknown, r: UploadRow) => (
        r.runs.count
          ? <Tag color={r.runs.latest_status === 'succeeded' ? 'success' : 'processing'}>
              {r.runs.count} 个 · {r.runs.latest_status}
            </Tag>
          : <Tag color="default">无引用</Tag>
      ) },
    { title: '', key: 'op', width: 80,
      render: (_: unknown, r: UploadRow) => (
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

  const renderFiles = (r: UploadRow) => {
    const files = filesByDir[r.dir]
    if (loadingDir === r.dir && !files) return <Typography.Text type="secondary">读取中…</Typography.Text>
    if (!files?.length) return <Typography.Text type="secondary">目录内没有可复用文件</Typography.Text>
    const usable = files.filter((f) => supported(f.name))
    const selInDir = files.filter((f) => fileSel.includes(f.path))
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space size={8}>
          <Button size="small" onClick={() => setFileSel(
            Array.from(new Set([...fileSel, ...usable.map((f) => f.path)])))}>全选本目录</Button>
          <Button size="small" onClick={() => setFileSel(
            fileSel.filter((p) => !files.some((f) => f.path === p)))}>取消本目录</Button>
          <Typography.Text type="secondary">
            {files.length} 个文件{extensions?.length ? `，${usable.length} 个可复用` : ''}；
            已选本目录 {selInDir.length} 个
          </Typography.Text>
        </Space>
        <div>
          {files.slice(((filePage[r.dir] ?? 1) - 1) * 30, (filePage[r.dir] ?? 1) * 30).map((f) => (
            <div key={f.path} style={{ padding: '2px 0' }}>
              <Checkbox
                checked={fileSel.includes(f.path)}
                disabled={!supported(f.name)}
                onChange={(e) => toggleFile(f.path, e.target.checked)}
              >
                <span title={f.path}>{f.rel}</span>
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{humanSize(f.size)}</Typography.Text>
                {!supported(f.name) && <Typography.Text type="warning" style={{ marginLeft: 8 }}>类型不支持</Typography.Text>}
              </Checkbox>
            </div>
          ))}
          {files.length > 30 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
              <SimplePager page={filePage[r.dir] ?? 1} pageSize={30} total={files.length}
                onChange={(pg) => setFilePage((prev) => ({ ...prev, [r.dir]: pg }))} />
            </div>
          )}
        </div>
      </Space>
    )
  }

  return (
    <Card size="small" styles={{ body: { padding: 0 } }}
      title={(
        <span style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <RightOutlined style={{ fontSize: 11, marginRight: 6 }} /> : <DownOutlined style={{ fontSize: 11, marginRight: 6 }} />}
          {title}
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>({rows.length})</Typography.Text>
        </span>
      ) }
      extra={picked.length > 0 ? (
        <Popconfirm title={`批量删除 ${picked.length} 个无引用原件？`}
          onConfirm={() => del.mutate(picked)}>
          <Button size="small" danger icon={<DeleteOutlined />}>批量删除（{picked.length}）</Button>
        </Popconfirm>
      ) : undefined}>
      <Table size="small" rowKey="dir" columns={cols} dataSource={rows} style={{ display: collapsed ? 'none' : undefined }}
        loading={uploads.isLoading} pagination={{ pageSize: 10, showSizeChanger: false }}
        expandable={{
          expandedRowKeys: expanded,
          onExpand: (expand, record) => toggleDir((record as UploadRow).dir, expand),
          expandedRowRender: (record) => renderFiles(record as UploadRow),
        }}
        rowSelection={{
          selectedRowKeys: picked,
          onChange: (keys) => setPicked(keys as string[]),
          // 有引用的行不可勾选（后端 409 防呆兜底）
          getCheckboxProps: (r: UploadRow) => ({ disabled: r.runs.count > 0 }),
        }} />
      {onUseFiles && fileSel.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(5,5,5,0.06)' }}>
          <Space>
            <Typography.Text>已选 {fileSel.length} 个已上传文件</Typography.Text>
            <Button type="primary" size="small" icon={<PlayCircleOutlined />}
              onClick={() => onUseFiles(fileSel)}>{useLabel}</Button>
            <Button size="small" onClick={() => setFileSel([])}>清空选择</Button>
          </Space>
        </div>
      )}
    </Card>
  )
}
