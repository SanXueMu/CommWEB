/** DataBrowser：'data.browser' 通用视图——会员声明驱动的数据工作台。
 *  纯壳准则：工具名/内置视图名/导出配置全部来自 props 声明（业务数据），本组件零业务知识。
 *
 *  声明 props：
 *  {
 *    source: { kind: 'dbs' } | { kind: 'records_json' },      // 库清点选择 或 粘贴 records
 *    extract?: { tool, input },                               // records_json 源可省略（records 即数据）
 *    view?: { tool, input, records_key?, builtin_views? },    // 可选：视图计算（ViewSpec）
 *    export?: { tool, input, view_key? },                     // 可选：产物导出 + 下载
 *    records_hint?: string
 *  }
 *  模板键：{{source}}（库路径）/ {{records}}（当前记录）/ {{view.rows}} 等视图产物键。
 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Divider, Select, Space, Typography } from 'antd'

import { apiFor } from '@/api/client'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type { OcrDbFile } from '@/api/types'
import { useActivePid } from '@/transfer/context'
import { ResultRenderer } from '../ResultRenderer'
import { SpecEditor } from '../SpecEditor'
import { FileUpload } from '../FileUpload'
import { DownloadButton } from '../DownloadButton'

export interface DataBrowserProps {
  source: { kind: 'dbs' } | { kind: 'records_json' }
  extract?: { tool: string; input: Record<string, unknown> }
  view?: { tool: string; input: Record<string, unknown>; records_key?: string; builtin_views?: string[] }
  export?: { tool: string; input: Record<string, unknown> }
  records_hint?: string
}

function fillTemplate(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value
  const m = value.match(/^\{\{([\w.[\]]+)\}\}$/)
  if (!m) return value
  const path = m[1]
  const resolved = path.split('.').reduce<unknown>(
    (node, key) => (node == null ? node : (node as Record<string, unknown>)[key]),
    ctx,
  )
  return resolved === undefined ? value : resolved
}

function fillInput(input: Record<string, unknown>, ctx: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, fillTemplate(v, ctx)]))
}

async function runTool(api: ReturnType<typeof apiFor>, tool: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const created = await api.createTask(tool, input)
  for (let i = 0; i < 300; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const detail = await api.getTask(created.handle)
    if (detail.status === 'succeeded') return detail.output ?? {}
    if (['failed', 'failed_review', 'cancelled'].includes(detail.status)) {
      throw new Error(typeof detail.error === 'object' && detail.error ? (detail.error as { message?: string }).message ?? '任务失败' : String(detail.error ?? '任务失败'))
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('任务超时')
}

export function DataBrowser() {
  const props = useViewProps() as unknown as DataBrowserProps
  const { source, extract, view, export: exportDecl, records_hint } = props
  const pid = useActivePid()
  const api = apiFor(pid)
  const [dbs, setDbs] = useState<OcrDbFile[]>([])
  const [dbPath, setDbPath] = useState('')
  const [recordsText, setRecordsText] = useState('')
  const [records, setRecords] = useState<Record<string, unknown>[] | null>(null)
  const [viewSpec, setViewSpec] = useState('')
  const [viewOut, setViewOut] = useState<Record<string, unknown> | null>(null)
  const [exportOut, setExportOut] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (source.kind !== 'dbs') return
    api.listDbs().then((d) => setDbs(d.dbs)).catch(() => setDbs([]))
  }, [source.kind])

  const parsedRecords = useMemo(() => {
    if (!recordsText.trim()) return null
    try {
      const parsed = JSON.parse(recordsText)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }, [recordsText])

  async function handleExtract() {
    if (!extract) {
      setRecords(parsedRecords)
      return
    }
    if (source.kind === 'dbs' && !dbPath) return
    setBusy('extract'); setError(null)
    try {
      const ctx = source.kind === 'dbs' ? { source: dbPath } : { source: '' }
      const out = await runTool(api, extract.tool, fillInput(extract.input, ctx))
      setRecords((out.records as Record<string, unknown>[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function handleView() {
    if (!view) return
    let spec: unknown = viewSpec.trim()
    try {
      spec = JSON.parse(viewSpec)
    } catch { /* 内置视图名（字符串）直接传 */ }
    setBusy('view'); setError(null)
    try {
      const out = await runTool(api, view.tool, fillInput(view.input, {
        records,
        view_spec: spec,
      }))
      setViewOut(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function handleExport() {
    if (!exportDecl) return
    setBusy('export'); setError(null)
    try {
      const out = await runTool(api, exportDecl.tool, fillInput(exportDecl.input, {
        view: viewOut ?? {},
        records,
      }))
      setExportOut(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const tableData = (viewOut?.rows as Record<string, unknown>[]) ?? records

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" title={source.kind === 'dbs' ? '选择数据源' : '粘贴记录集 JSON'}>
        {source.kind === 'dbs' ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space size={8} wrap>
              <Select
                showSearch
                style={{ minWidth: 320 }}
                placeholder="选择数据库文件（{{source}}）"
                value={dbPath || undefined}
                onChange={setDbPath}
                options={dbs.map((d) => ({ value: d.path, label: `${d.name}（${Math.round(d.size / 1024)}KB）` }))}
              />
              <FileUpload value={dbPath} onChange={setDbPath} />
            </Space>
            {extract && (
              <Button type="primary" loading={busy === 'extract'} disabled={!dbPath} onClick={handleExtract}>
                提取记录
              </Button>
            )}
          </Space>
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <SpecEditor
              value={recordsText}
              onChange={setRecordsText}
              rows={6}
              specLabel="records"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {records_hint ?? '记录数组，如 [{"字段": "值", "页码": 1}]'}
            </Typography.Text>
            {extract && (
              <Button type="primary" loading={busy === 'extract'} disabled={!parsedRecords} onClick={handleExtract}>
                载入记录
              </Button>
            )}
          </Space>
        )}
      </Card>

      {view && (
        <Card size="small" title="视图计算">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <SpecEditor
              value={viewSpec}
              onChange={setViewSpec}
              rows={6}
              builtinViews={view.builtin_views ?? []}
              specLabel="内置视图"
            />
            <Button type="primary" loading={busy === 'view'} disabled={!records} onClick={handleView}>
              计算视图
            </Button>
          </Space>
        </Card>
      )}

      {error && <Alert type="error" showIcon message={error} />}

      {tableData && (
        <Card size="small" title={viewOut ? '视图结果' : '记录'}>
          <ResultRenderer output={viewOut ?? { records: tableData }} />
          {exportDecl && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Space size={8} wrap>
                <Button loading={busy === 'export'} onClick={handleExport}>
                  导出产物
                </Button>
                {exportOut && typeof exportOut.file === 'string' && (
                  <DownloadButton path={exportOut.file as string} label="下载导出文件" />
                )}
              </Space>
            </>
          )}
        </Card>
      )}
    </Space>
  )
}

