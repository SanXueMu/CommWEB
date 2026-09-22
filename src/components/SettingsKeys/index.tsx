/** settings.keys 协议级视图：CommAND keys 协议端点管理界面。 */

import { useCallback, useEffect, useState } from 'react'
import { apiFor } from '@/api/client'
import type { OcrKey } from '@/api/types'
import { useConfirm } from '@/components/ConfirmDialog'
import { useActivePid } from '@/transfer/context'
import { Button, Card, Input, Modal } from '@/ui'
import { Form, useForm } from '@/ui/form'

export interface SettingsKeysProps {
  title?: string
}

export function SettingsKeys({ props }: { props?: SettingsKeysProps }) {
  const pid = useActivePid()
  const api = apiFor(pid)
  const [keys, setKeys] = useState<OcrKey[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<null | Partial<OcrKey>>(null)
  const [form] = useForm()
  const { confirm } = useConfirm()

  const reload = useCallback(() => {
    api.listKeys().then((d) => setKeys(d.keys)).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [api])

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
        name: String(values.name ?? ''),
        provider: values.provider as string,
        base_url: values.base_url as string,
        api_key: (values.api_key || undefined) as unknown as string,
        is_default: Boolean(values.is_default),
      })
      setEditing(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>{props?.title ?? '密钥管理'}</strong>
        <Button variant="primary" size="sm" onClick={() => { setEditing({}); form.resetFields() }}>新增密钥</Button>
      </div>
      {error && <div role="alert" style={{ color: 'var(--cw-danger)', marginBottom: 12 }}>{error}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['名称', 'Provider', 'Base URL', '密钥', '默认', '操作'].map((title) => <th key={title} style={{ textAlign: 'left', padding: 8 }}>{title}</th>)}</tr></thead>
          <tbody>{keys.map((record) => (
            <tr key={record.name}>
              <td style={{ padding: 8 }}>{record.name}</td>
              <td style={{ padding: 8 }}>{record.provider}</td>
              <td style={{ padding: 8 }}>{record.base_url}</td>
              <td style={{ padding: 8 }}><code>{record.api_key}</code></td>
              <td style={{ padding: 8 }}>{record.is_default ? '默认' : ''}</td>
              <td style={{ padding: 8 }}><div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={() => { setEditing(record); form.setFieldsValue({ ...record, api_key: '' }) }}>编辑</Button>
                <Button size="sm" variant="danger" onClick={async () => {
                  if (await confirm({ title: `删除密钥 ${record.name}？`, options: [{ value: true, label: '删除', danger: true }] })) await handleDelete(record.name)
                }}>删除</Button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <Modal isOpen={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <Modal.Backdrop />
        <Modal.Container><Modal.Dialog>
          <Modal.Header>{editing?.name ? `编辑密钥：${editing.name}` : '新增密钥'}</Modal.Header>
          <Modal.Body>
            <Form form={form} onFinish={handleSave}>
              <Form.Item name="name" label="名称"><Input disabled={Boolean(editing?.name)} placeholder="唯一名称，如 my-provider" /></Form.Item>
              <Form.Item name="provider" label="Provider"><Input placeholder="供应商标识" /></Form.Item>
              <Form.Item name="base_url" label="Base URL"><Input placeholder="https://.../v1" /></Form.Item>
              <Form.Item name="api_key" label="API Key"><Input type="password" placeholder={editing?.name ? '留空不改' : '密钥'} /></Form.Item>
              <Form.Item name="is_default" label="设为默认" valuePropName="checked"><input type="checkbox" /></Form.Item>
            </Form>
          </Modal.Body>
          <Modal.Footer><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button variant="primary" onClick={handleSave}>保存</Button></Modal.Footer>
          <Modal.CloseTrigger />
        </Modal.Dialog></Modal.Container>
      </Modal>
    </Card>
  )
}
