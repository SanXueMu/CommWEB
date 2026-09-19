/** 识别模版一站式管理（批 J1，视图类型 templates.manager）：
 *  列表 / 启停开关 / 删除 / 新建与编辑（常用字段表单 + 高级主体 JSON）。
 *  数据面 = CommAND REST /ocr/templates（同步 CRUD，区别于 spec.template.* 异步工具链路）。 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Button, Drawer, Form, Input, Modal as AntModal, Popconfirm, Select, Space, Switch, Table, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'

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
  const { message } = AntApp.useApp()
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
    onSuccess: () => { message.success('已更新启用状态'); invalidate() },
    onError: (err) => message.error(`启停失败：${(err as Error).message ?? err}`),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFor(pid).send(`/ocr/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => { message.success('已删除'); invalidate() },
    onError: (err) => message.error(`删除失败：${(err as Error).message ?? err}`),
  })

  const columns = [
    { title: '模版 ID', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类别', dataIndex: 'category', key: 'category', width: 90,
      render: (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v,
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, row: TemplateRow) => (
        <Switch
          size="small"
          checked={v}
          loading={setEnabled.isPending && setEnabled.variables?.id === row.id}
          onChange={(checked) => setEnabled.mutate({ id: row.id, enabled: checked })}
        />
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170 },
    {
      title: '操作', key: 'actions', width: 130,
      render: (_: unknown, row: TemplateRow) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => { setEditing(row); setDrawerOpen(true) }}>编辑</Button>
          <Popconfirm title={`删除模版 ${row.id}？`} onConfirm={() => remove.mutate(row.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Input.Search
          placeholder="搜索模版名称/ID"
          allowClear
          style={{ width: 240 }}
          onSearch={setKeyword}
        />
        <Select
          allowClear
          placeholder="类别"
          style={{ width: 120 }}
          options={CATEGORIES}
          onChange={setCategory}
        />
        <Button type="primary" onClick={() => { setEditing(null); setDrawerOpen(true) }}>
          新建模版
        </Button>
      </Space>
      <Table<TemplateRow>
        size="small"
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={listQuery.data?.templates ?? []}
        columns={columns}
        pagination={false}
        locale={{ emptyText: '暂无识别模版（可新建或运行 seed 脚本灌入内置模版）' }}
      />
      <TemplateDrawer
        open={drawerOpen}
        template={editing}
        providerId={pid}
        onClose={() => setDrawerOpen(false)}
      />
    </Space>
  )
}

/** 新建/编辑抽屉：常用字段表单 + 高级主体 JSON（prompt/fields/rules 等按模版本体直编）。 */
function TemplateDrawer({ open, template, providerId, onClose }: {
  open: boolean
  template: TemplateRow | null
  providerId: string
  onClose: () => void
}) {
  const { message } = AntApp.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
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
      message.success(template ? '模版已更新' : '模版已创建')
      queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'ocr-templates'] })
      onClose()
    } catch (err) {
      message.error(`保存失败：${(err as Error).message ?? err}`)
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
      message.error(`高级主体不是合法 JSON：${(err as Error).message}`)
      return
    }
    // Z2 防呆：编辑态主体缺核心内容 → 多半是拿桩/空壳保存，确认后再放行
    if (template && (typeof body.prompt_template !== 'string' || !body.prompt_template.trim()
      || !Array.isArray(body.fields) || body.fields.length === 0)) {
      AntModal.confirm({
        title: '高级主体缺少识别逻辑',
        content: '检测到 prompt_template 或 fields 为空。继续保存将清空该模版的识别规则（原内容不可从界面恢复），确定继续吗？',
        okText: '仍然保存', okButtonProps: { danger: true }, cancelText: '返回检查',
        onOk: () => send(head, body),
      })
      return
    }
    await send(head, body)
  }

  return (
    <Drawer
      title={template ? `编辑模版 ${template.id}` : '新建识别模版'}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnHidden
      extra={<Button type="primary" loading={saving || loadingBody} onClick={save} disabled={loadingBody}>保存</Button>}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="id" label="模版 ID"
          rules={[{ required: true, pattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, message: '点分小写 id，如 tpl.invoice.voucher' }]}>
          <Input disabled={Boolean(template)} placeholder="tpl.invoice.voucher" />
        </Form.Item>
        <Space size={12} style={{ display: 'flex' }}>
          <Form.Item name="name" label="名称" style={{ flex: 1 }}><Input /></Form.Item>
          <Form.Item name="category" label="类别" style={{ width: 120 }}>
            <Select options={CATEGORIES} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          高级主体（JSON）：prompt_template / fields / rules / example / hooks / record_mode / view_spec / input_schema
        </Typography.Paragraph>
        <Input.TextArea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={14}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Form>
    </Drawer>
  )
}
