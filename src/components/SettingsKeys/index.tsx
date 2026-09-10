/** SettingsKeys：'settings.keys' 协议级视图——CommAND keys 协议端点管理界面。
 *  纯壳准则：无业务默认值（provider/模型等由使用者自填）；显隐由站点声明驱动。 */

import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd'

import { apiFor } from '@/api/client'
import type { OcrKey } from '@/api/types'
import { useActivePid } from '@/transfer/context'

export interface SettingsKeysProps {
  title?: string
}

export function SettingsKeys({ props }: { props?: SettingsKeysProps }) {
  const pid = useActivePid()
  const api = apiFor(pid)
  const [keys, setKeys] = useState<OcrKey[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<null | Partial<OcrKey>>(null)
  const [form] = Form.useForm()

  const reload = useCallback(() => {
    api.listKeys().then((d) => setKeys(d.keys)).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => { reload() }, [reload])

  async function handleDelete(name: string) {
    try {
      await api.deleteKey(name)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSave() {
    const values = await form.validateFields()
    try {
      await api.putKey({
        name: values.name,
        provider: values.provider,
        base_url: values.base_url,
        api_key: values.api_key || undefined,
        is_default: !!values.is_default,
      })
      setEditing(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: 'Provider', dataIndex: 'provider' },
    { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
    {
      title: '密钥', dataIndex: 'api_key',
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: '默认', dataIndex: 'is_default',
      render: (v: boolean) => (v ? <Tag color="green">默认</Tag> : null),
    },
    {
      title: '操作',
      render: (_: unknown, record: OcrKey) => (
        <Space size={8}>
          <Button size="small" onClick={() => { setEditing(record); form.setFieldsValue({ ...record, api_key: '' }) }}>
            编辑
          </Button>
          <Popconfirm title={`删除密钥 ${record.name}？`} onConfirm={() => handleDelete(record.name)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      size="small"
      title={props?.title ?? '密钥管理'}
      extra={<Button type="primary" size="small" onClick={() => { setEditing({}); form.resetFields() }}>新增密钥</Button>}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Table rowKey="name" size="small" columns={columns as never} dataSource={keys} pagination={false} />

      <Modal
        open={editing !== null}
        title={editing?.name ? `编辑密钥：${editing.name}` : '新增密钥'}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
            <Input disabled={!!editing?.name} placeholder="唯一名称，如 my-provider" />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="供应商标识" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="https://.../v1" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" extra={editing?.name ? '留空表示不修改' : undefined}>
            <Input.Password placeholder={editing?.name ? '留空不改' : '密钥'} />
          </Form.Item>
          <Form.Item name="is_default" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
