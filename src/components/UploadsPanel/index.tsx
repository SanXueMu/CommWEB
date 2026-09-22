/**
 * AF4：上传原件台账面板（翻译/OCR 工作台共用）。
 * 上传批次目录列表：日期 / 批次名 / 文件数 / 大小 / 来源 / 引用任务（数 + 最新状态）。
 * 行内删除 + 批量删除——仅无任务引用的原件可删；有引用 → 409 提示先删任务。
 *
 * AN（2026-09-20）：目录行可**展开** → 勾选目录下文件 → 「用所选发起识别」——
 * 免重新上传即可对已上传过的原件重跑（onUseFiles 回调注入；不传则不显示复用入口）。
 */
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SimplePager } from '@/components/ui/SimplePager'
import { apiFor, type UploadFileItem } from '@/api/client'
import { useActivePid } from '@/transfer/context'
import { humanSize } from '@/lib/size'
import { Button, Card, Chip } from '@/ui'
import { useConfirm } from '@/components/ConfirmDialog'

function Text({ children, ...props }: { children: ReactNode; [key: string]: unknown }) { return <span {...props}>{children}</span> }
function Checkbox({ checked, disabled, onChange, children }: { checked?: boolean; disabled?: boolean; onChange: (event: { target: { checked: boolean } }) => void; children?: ReactNode }) { return <label><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange({ target: { checked: event.target.checked } })} /> {children}</label> }
function Space({ children, style, direction, size }: { children: ReactNode; style?: React.CSSProperties; direction?: 'vertical' | 'horizontal'; size?: number }) { return <div style={{ display: 'flex', flexDirection: direction === 'vertical' ? 'column' : 'row', gap: size ?? 8, ...style }}>{children}</div> }
const Typography = { Text }

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
  const [uploadPage, setUploadPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const { confirm } = useConfirm()
  const uploads = useQuery({
    queryKey: ['provider', pid, 'uploads'],
    queryFn: () => api.listUploads(),
  })
  const del = useMutation({
    mutationFn: (roots: string[]) => api.deleteUploads(roots),
    onSuccess: (r) => {
      setNotice(`已删除 ${r.removed.length} 个原件目录`)
      setPicked([])
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'uploads'] })
    },
    onError: (e: Error) => setNotice(e.message),
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
      setNotice(`读取目录文件失败：${(e as Error).message}`)
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

  const renderFiles = (r: UploadRow) => {
    const files = filesByDir[r.dir]
    if (loadingDir === r.dir && !files) return <Typography.Text type="secondary">读取中…</Typography.Text>
    if (!files?.length) return <Typography.Text type="secondary">目录内没有可复用文件</Typography.Text>
    const usable = files.filter((f) => supported(f.name))
    const selInDir = files.filter((f) => fileSel.includes(f.path))
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space size={8}>
              <Button size="sm" onClick={() => setFileSel(
            Array.from(new Set([...fileSel, ...usable.map((f) => f.path)])))}>全选本目录</Button>
              <Button size="sm" onClick={() => setFileSel(
            fileSel.filter((p) => !files.some((f) => f.path === p)))}>取消本目录</Button>
          <Typography.Text type="secondary">
            {files.length} 个文件{extensions?.length ? `，${usable.length} 个可复用` : ''}；
            已选本目录 {selInDir.length} 个
          </Typography.Text>
        </Space>
        {/* 展开区限高（UI 原则②）：长目录不再把整页拉长，列表在容器内滚动 */}
        <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
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

  return <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <button type="button" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setCollapsed((v) => !v)}>{collapsed ? '▶' : '▼'} {title} <Text>({rows.length})</Text></button>
      {picked.length > 0 && <Button size="sm" variant="danger" onClick={async () => {
        if (await confirm({ title: `批量删除 ${picked.length} 个无引用原件？`, options: [{ value: true, label: '删除', danger: true }] })) del.mutate(picked)
      }}>批量删除（{picked.length}）</Button>}
    </div>
    {notice && <div role="alert" style={{ marginBottom: 8 }}>{notice}</div>}
    {!collapsed && <div style={{ overflowX: 'auto' }}>
      {uploads.isLoading ? <Text>读取中...</Text> : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['', '日期', '批次', '文件', '大小', '来源', '引用任务', '操作'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 8 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice((uploadPage - 1) * 10, uploadPage * 10).map((r) => <>
          <tr key={r.dir}>
            <td style={{ padding: 8 }}><Checkbox checked={picked.includes(r.dir)} disabled={r.runs.count > 0} onChange={(e) => setPicked((prev) => e.target.checked ? [...prev, r.dir] : prev.filter((p) => p !== r.dir))} /></td>
            <td style={{ padding: 8 }}>{r.date}</td><td style={{ padding: 8 }} title={r.path}>{r.label}</td><td style={{ padding: 8 }}>{r.count} 个</td><td style={{ padding: 8 }}>{humanSize(r.size)}</td>
            <td style={{ padding: 8 }}><Chip>{SOURCE_LABEL[r.source] ?? r.source}</Chip></td>
            <td style={{ padding: 8 }}>{r.runs.count ? <Chip>{r.runs.count} 个 · {r.runs.latest_status}</Chip> : <Chip>无引用</Chip>}</td>
            <td style={{ padding: 8 }}><div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => toggleDir(r.dir, !expanded.includes(r.dir))}>{expanded.includes(r.dir) ? '收起' : '展开'}</Button>
              <Button size="sm" variant="danger" isDisabled={r.runs.count > 0} onClick={async () => { if (await confirm({ title: `删除原件「${r.label}」？`, options: [{ value: true, label: '删除', danger: true }] })) del.mutate([r.dir]) }}>删除</Button>
            </div></td>
          </tr>
          {expanded.includes(r.dir) && <tr key={`${r.dir}-files`}><td colSpan={8} style={{ padding: 12, background: 'var(--cw-surface-muted)' }}>{renderFiles(r)}</td></tr>}
        </>)}</tbody>
      </table>}
      {rows.length > 10 && <SimplePager page={uploadPage} pageSize={10} total={rows.length} onChange={setUploadPage} />}
    </div>}
    {onUseFiles && fileSel.length > 0 && <div style={{ paddingTop: 8 }}><Space><Text>已选 {fileSel.length} 个已上传文件</Text><Button variant="primary" size="sm" onClick={() => onUseFiles(fileSel)}>{useLabel}</Button><Button size="sm" onClick={() => setFileSel([])}>清空选择</Button></Space></div>}
  </Card>
}
