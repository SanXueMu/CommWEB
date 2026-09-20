/** 批量上传组件：本地目录（webkitdirectory）/ 压缩包（.zip）/ 服务器目录三形态，产出文件清单。 */

import { useRef, useState } from 'react'
import { CheckCircleOutlined, DeleteOutlined, FolderOpenOutlined, InboxOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Input, Segmented, Space, Tag, Typography, message } from 'antd'
import { api, type BatchFileEntry } from '@/api/client'
import { humanSize } from '@/lib/size'

export type BatchMode = 'dir' | 'zip' | 'server'

export function BatchUpload({
  extensions = [], skip = [], maxFiles = 200, maxTotalMB = 500, disabled, onPicked, source,
}: {
  /** 允许的扩展名（含点，如 ['.pdf', '.docx']）；空数组 = 不限制 */
  extensions?: string[]
  /** 声明驱动的「跳过类型」（如 .ppt/.pptx）：交服务端打标留档，不建任务 */
  skip?: string[]
  maxFiles?: number
  maxTotalMB?: number
  /** AF4：上传来源（写入批次清单，原件面板按工作台展示） */
  source?: string
  disabled?: boolean
  onPicked: (files: BatchFileEntry[], label: string, batch?: { batch_id?: string; root?: string }) => void
}) {
  const [mode, setMode] = useState<BatchMode>('dir')
  const [picked, setPicked] = useState<File[]>([])
  const [serverPath, setServerPath] = useState('')
  const [serverFiles, setServerFiles] = useState<BatchFileEntry[]>([])
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([])
  const [busy, setBusy] = useState(false)
  const dirRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  const extQuery = extensions.join(',')
  const maxBytes = maxTotalMB * 1024 * 1024

  const sizeOf = (files: File[]) => files.reduce((s, f) => s + f.size, 0)
  /** 操作系统垃圾文件：不参与翻译也不进交付目录（避免污染原目录结构）。 */
  const isJunk = (name: string) => {
    const base = name.split('/').pop() ?? name
    return base === '.DS_Store' || base === 'Thumbs.db' || base === 'desktop.ini'
      || base.startsWith('~$')
  }

  const takeDir = (list: FileList | null) => {
    const all = Array.from(list ?? [])
    if (!all.length) return
    // 不再按扩展名过滤：**全部上传**，由服务端按声明分类（不可翻译的留档跳过），
    // 这样批次导出才能还原出与原目录完全一致的结构（2026-09-14 用户口径）。
    // 仅忽略操作系统垃圾文件（.DS_Store / Thumbs.db / desktop.ini / ~$ 临时文件）。
    const ok = all.filter((f) => !isJunk(f.name))
    if (ok.length > maxFiles) {
      message.error(`单批最多 ${maxFiles} 个文件（当前 ${ok.length} 个），请分批或改用压缩包`)
      return
    }
    if (sizeOf(ok) > maxBytes) {
      message.error(`合计超过 ${maxTotalMB}MB，请分批或改用压缩包`)
      return
    }
    setPicked(ok)
    const dropped = all.length - ok.length
    setSkipped(dropped > 0 ? [{ name: `${dropped} 个文件`, reason: '系统文件（.DS_Store/Thumbs.db 等），已忽略' }] : [])
    if (!ok.length) message.warning('所选目录内没有符合扩展名的文件')
  }

  const uploadDir = async () => {
    setBusy(true)
    try {
      const result = await api.uploadFiles(picked, extQuery, skip, source)
      const skippedByServer = result.skipped ?? []
      setSkipped(skippedByServer)
      // 空文件不进任务清单（连暂停记录都不建）；PPT 等「跳过类型」保留，
      // 由工作台建一条暂停记录留档（用户能看到「哪些没处理、为什么」）
      const usable = result.files.filter((f) => !f.empty)
      onPicked(usable, result.name, { batch_id: result.batch_id, root: result.name })
      message.success(`已上传 ${usable.length} 个文件（${humanSize(result.size)}）`
        + (skippedByServer.length ? `，跳过 ${skippedByServer.length} 条` : ''))
      setPicked([])
    } catch (error) {
      message.error(`上传失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const uploadZip = async () => {
    if (!picked.length) return
    setBusy(true)
    try {
      const result = await api.uploadArchive(picked[0], extQuery, skip, source)
      const skippedByServer = result.skipped ?? []
      setSkipped(skippedByServer)
      const usable = result.files.filter((f) => !f.empty)
      onPicked(usable, result.name, { batch_id: result.batch_id, root: result.name })
      message.success(`已解压 ${usable.length} 个文件（${humanSize(result.size)}）`
        + (skippedByServer.length ? `，跳过 ${skippedByServer.length} 条` : ''))
      setPicked([])
    } catch (error) {
      message.error(`解压失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const listServer = async () => {
    if (!serverPath.trim()) {
      message.warning('请填写服务器上的目录路径')
      return
    }
    setBusy(true)
    try {
      const result = await api.listFiles(serverPath.trim(), extQuery)
      setServerFiles(result.files)
      setSkipped([])
      if (!result.count) message.warning('该目录下没有符合扩展名的文件')
      else message.success(`列出 ${result.count} 个文件${result.truncated ? '（已截断）' : ''}`)
    } catch (error) {
      message.error(`列举失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const accept = extensions.join(',')
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Segmented
        block
        value={mode}
        disabled={disabled || busy}
        onChange={(v) => { setMode(v as BatchMode); setPicked([]); setServerFiles([]); setSkipped([]) }}
        options={[
          { value: 'dir', label: '选本地目录' },
          { value: 'zip', label: '传压缩包' },
          { value: 'server', label: '服务器目录' },
        ]}
      />

      {mode === 'dir' && (
        <>
          <input
            ref={dirRef} type="file" multiple hidden style={{ display: 'none' }}
            {...({ webkitdirectory: 'true', directory: '' } as Record<string, string>)}
            onChange={(e) => { takeDir(e.target.files); e.target.value = '' }}
          />
          <Flex gap={8} wrap="wrap" align="center">
            <Button icon={<FolderOpenOutlined />} disabled={disabled || busy} onClick={() => dirRef.current?.click()}>
              选择目录
            </Button>
            {picked.length > 0 && (
              <>
                <Tag>{picked.length} 个文件 · {humanSize(sizeOf(picked))}</Tag>
                <Button type="primary" loading={busy} onClick={uploadDir}>上传这批文件</Button>
                <Button icon={<DeleteOutlined />} disabled={busy} onClick={() => setPicked([])}>清空</Button>
              </>
            )}
            {!picked.length && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                选择整个文件夹（保留子目录结构）{extensions.length ? `，仅取 ${accept}` : ''}，上限 {maxFiles} 个 / {maxTotalMB}MB
              </Typography.Text>
            )}
          </Flex>
        </>
      )}

      {mode === 'zip' && (
        <>
          <input
            ref={zipRef} type="file" accept=".zip,application/zip" hidden style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              setSkipped([])
              setPicked(f ? [f] : [])
              e.target.value = ''
              if (f && f.size > maxBytes) message.warning(`压缩包 ${humanSize(f.size)} 超过 ${maxTotalMB}MB，可能被服务端拒绝`)
            }}
          />
          <Flex gap={8} wrap="wrap" align="center">
            <Button icon={<InboxOutlined />} disabled={disabled || busy} onClick={() => zipRef.current?.click()}>
              选择 .zip
            </Button>
            {picked[0] && (
              <>
                <Tag>{picked[0].name} · {humanSize(picked[0].size)}</Tag>
                <Button type="primary" loading={busy} onClick={uploadZip}>上传并解压</Button>
                <Button icon={<DeleteOutlined />} disabled={busy} onClick={() => setPicked([])}>清空</Button>
              </>
            )}
            {!picked[0] && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                先在本机把目录压成 .zip 再上传；服务端解压后按目录结构列出
              </Typography.Text>
            )}
          </Flex>
        </>
      )}

      {mode === 'server' && (
        <>
          <Flex gap={8} wrap="wrap" align="center">
            <Input
              style={{ minWidth: 280, flex: 1 }} placeholder="服务器容器内目录，如 /app/data/uploads/2026-09-14"
              value={serverPath} disabled={disabled || busy}
              onChange={(e) => setServerPath(e.target.value)} onPressEnter={listServer}
            />
            <Button type="primary" loading={busy} disabled={disabled} onClick={listServer}>列举文件</Button>
          </Flex>
          {serverFiles.length > 0 && (
            <>
              <Space wrap>
                <Tag color="green"><CheckCircleOutlined /> {serverFiles.length} 个文件</Tag>
                <Tag>{humanSize(serverFiles.reduce((s, f) => s + f.size, 0))}</Tag>
                <Button size="small" type="primary" onClick={() => onPicked(serverFiles, serverPath.trim().split('/').pop() || '服务器目录')}>
                  加入清单
                </Button>
              </Space>
              {serverFiles.slice(0, 5).map((f) => (
                <Typography.Text key={f.path} type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {f.rel ?? f.name}
                </Typography.Text>
              ))}
              {serverFiles.length > 5 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  … 其余 {serverFiles.length - 5} 个
                </Typography.Text>
              )}
            </>
          )}
        </>
      )}

      {skipped.length > 0 && (
        <Alert
          type="warning" showIcon
          message={`${skipped.length} 条已跳过`}
          description={
            <Typography.Text style={{ fontSize: 12 }}>
              {skipped.slice(0, 5).map((s) => `${s.name}：${s.reason}`).join('；')}
              {skipped.length > 5 ? ` …另 ${skipped.length - 5} 条` : ''}
            </Typography.Text>
          }
        />
      )}
    </Space>
  )
}
