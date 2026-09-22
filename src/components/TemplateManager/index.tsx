/** 识别模版一站式管理（批 J1，视图类型 templates.manager）：
 *  列表 / 启停开关 / 删除 / 新建与编辑（常用字段表单 + 高级主体 JSON）。
 *  数据面 = CommAND REST /ocr/templates（同步 CRUD，区别于 spec.template.* 异步工具链路）。 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'
import { Button } from '@/ui'
import { Form, useForm } from '@/ui/form'

interface TemplateRow {
  id: string
  name?: string
  category?: string
  enabled?: boolean
  updated_at?: string
  [key: string]: unknown
}

const CATEGORIES = [
  { value: 'invoice', label: '发票' },
  { value: 'contract', label: '合同' },
  { value: 'audit', label: '审计' },
  { value: 'custom', label: '自定义' },
]

export function TemplateManager() {
  const pid = useActivePid()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const listQuery = useQuery({
    queryKey: ['provider', pid, 'ocr-templates', keyword, category],
    queryFn: () => {
      const params = new URLSearchParams()
      if (keyword) params.set('keyword', keyword)
      if (category) params.set('category', category)
      const qs = params.toString()
      return apiFor(pid).get<{ templates: TemplateRow[] }>(`/ocr/templates${qs ? `?${qs}` : ''}`)
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider', pid, 'ocr-templates'] })

  const setEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFor(pid).send(`/ocr/templates/${encodeURIComponent(id)}/enabled`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => { console.info('已更新启用状态'); invalidate() },
    onError: (err) => console.error(`启停失败：${(err as Error).message ?? err}`),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFor(pid).send(`/ocr/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => { console.info('已删除'); invalidate() },
    onError: (err) => console.error(`删除失败：${(err as Error).message ?? err}`),
  })

  const columns: any[] = [
    { title: '模版 ID', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类别', dataIndex: 'category', key: 'category', width: 90,
      render: (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v,
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, row: TemplateRow) => (
        <input
          type="checkbox"
          checked={v}
          disabled={setEnabled.isPending && setEnabled.variables?.id === row.id}
          onChange={(event) => setEnabled.mutate({ id: row.id, enabled: event.target.checked })}
        />
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170 },
    {
      title: '操作', key: 'actions', width: 130,
      render: (_: unknown, row: TemplateRow) => (
        <span style={{ display: 'flex', gap: 6 }}><Button size="sm" onClick={() => { setEditing(row); setDrawerOpen(true) }}>编辑</Button><Button size="sm" onClick={() => { if (window.confirm(`删除模版 ${row.id}？`)) remove.mutate(row.id) }}>删除</Button></span>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          placeholder="搜索模版名称/ID"
          style={{ width: 240 }}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          value={category ?? ''}
          style={{ width: 120 }}
          onChange={(e) => setCategory(e.target.value || undefined)}
        ><option value="">类别</option>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <Button onClick={() => { setEditing(null); setDrawerOpen(true) }}>
          新建模版
        </Button>
      </div>
      {listQuery.isLoading ? <div role="status">加载中...</div> : (listQuery.data?.templates ?? []).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--cw-text-secondary)' }}>暂无识别模版（可新建或运行 seed 脚本灌入内置模版）</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{columns.map((column) => <th key={column.key} style={{ textAlign: 'left', padding: 8 }}>{column.title}</th>)}</tr></thead><tbody>{(listQuery.data?.templates ?? []).map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key} style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{column.render ? column.render((row as Record<string, unknown>)[column.dataIndex as string], row) : (row as Record<string, unknown>)[column.dataIndex as string] as ReactNode}</td>)}</tr>)}</tbody></table></div>}
      <TemplateDrawer
        open={drawerOpen}
        template={editing}
        providerId={pid}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}

/** 新建/编辑抽屉：常用字段表单 + 高级主体 JSON（prompt/fields/rules 等按模版本体直编）。 */
function TemplateDrawer({ open, template, providerId, onClose }: {
  open: boolean
  template: TemplateRow | null
  providerId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form] = useForm()
  const [bodyText, setBodyText] = useState('')
  const [saving, setSaving] = useState(false)

  const [loadingBody, setLoadingBody] = useState(false)

  // Z2：编辑时必须拉取详情端点的全量主体（列表行只是计数桩，直接注入会丢
  // prompt_template/fields/rules/example/hooks，保存即毁模版）
  useEffect(() => {
    if (!open) return
    const base: Record<string, unknown> = template ?? {
      id: '', name: '', category: 'custom', enabled: true,
      prompt_template: '', fields: [], hooks: [],
    }
    form.setFieldsValue({
      id: base.id, name: base.name, category: base.category, enabled: base.enabled,
    })
    const inject = (full: Record<string, unknown>) => {
      const advanced: Record<string, unknown> = { ...full }
      delete advanced.id; delete advanced.name; delete advanced.category; delete advanced.enabled
      delete advanced.created_at; delete advanced.updated_at
      setBodyText(JSON.stringify(advanced, null, 2))
    }
    if (template) {
      setLoadingBody(true)
      apiFor(providerId).get<Record<string, unknown>>(`/ocr/templates/${encodeURIComponent(template.id)}`)
        .then(inject)
        .catch(() => inject(template))
        .finally(() => setLoadingBody(false))
    } else {
      inject(base)
    }
  }, [open, template, form, providerId])

  const send = async (head: Record<string, unknown>, body: Record<string, unknown>) => {
    const payload = { ...body, ...head, enabled: Boolean(head.enabled) }
    setSaving(true)
    try {
      await apiFor(providerId).send('/ocr/templates', {
        method: 'POST',
        body: JSON.stringify({ template: payload }),
      })
      console.info(template ? '模版已更新' : '模版已创建')
      queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'ocr-templates'] })
      onClose()
    } catch (err) {
      console.error(`保存失败：${(err as Error).message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    const head = await form.validateFields()
    let body: Record<string, unknown>
    try {
      body = bodyText.trim() ? JSON.parse(bodyText) : {}
    } catch (err) {
      console.error(`高级主体不是合法 JSON：${(err as Error).message}`)
      return
    }
    // Z2 防呆：编辑态主体缺核心内容 → 多半是拿桩/空壳保存，确认后再放行
    if (template && (typeof body.prompt_template !== 'string' || !body.prompt_template.trim()
      || !Array.isArray(body.fields) || body.fields.length === 0)) {
      if (window.confirm('高级主体缺少识别逻辑。继续保存将清空该模版的识别规则，确定继续吗？')) await send(head, body)
      return
    }
    await send(head, body)
  }

  return (
    (!open ? null : <aside role="dialog" style={{ position: 'fixed', inset: '0 0 0 auto', zIndex: 1000, width: 'min(560px, 100vw)', overflow: 'auto', background: 'var(--cw-surface)', boxShadow: '-8px 0 24px rgba(0,0,0,.18)', padding: 16 }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{template ? `编辑模版 ${template.id}` : '新建识别模版'}</strong><span style={{ display: 'flex', gap: 8 }}><Button isDisabled={loadingBody || saving} onClick={save}>保存</Button><button type="button" onClick={onClose}>关闭</button></span></header><Form form={form}>
        <Form.Item name="id" label="模版 ID"
          rules={[{ required: true, pattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, message: '点分小写 id，如 tpl.invoice.voucher' }]}>
          <input disabled={Boolean(template)} placeholder="tpl.invoice.voucher" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="name" label="名称"><input /></Form.Item>
          <Form.Item name="category" label="类别">
            <select>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <input type="checkbox" />
          </Form.Item>
        </div>
        <p style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
          高级主体（JSON）：prompt_template / fields / rules / example / hooks / record_mode / view_spec / input_schema
        </p>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={14}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Form></aside>)
  )
}
