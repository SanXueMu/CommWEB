/** 会话菜单：当前会员信息、回首页重选和会员登记管理。 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfirm } from '@/components/ConfirmDialog'
import { useProviders } from '@/transfer/context'
import { DEFAULT_PROVIDER } from '@/transfer/protocol'
import type { ProviderDescriptor } from '@/transfer/protocol'
import { Button, Card, Input, Modal } from '@/ui'
import { Form, useForm } from '@/ui/form'

const STATUS_COLOR: Record<ProviderDescriptor['status'], string> = {
  online: '#52c41a',
  offline: '#ff4d4f',
  degraded: '#faad14',
  unknown: '#d9d9d9',
}

export function ProviderMenu({ asLink = false }: { asLink?: boolean }) {
  const navigate = useNavigate()
  const { providers, activeId } = useProviders()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = providers.find((p) => p.id === activeId)

  if (asLink) {
    return <>
      <Button variant="tertiary" size="sm" onClick={() => setDrawerOpen(true)}>管理会员</Button>
      <ProviderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  }

  return <div style={{ position: 'relative', display: 'inline-flex' }}>
    <Button size="sm" onClick={() => setMenuOpen((value) => !value)}>
      <span style={{ color: STATUS_COLOR[active?.status ?? 'unknown'] }}>●</span> {active?.name ?? '选择系统'}
    </Button>
    {menuOpen && <Card style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, minWidth: 240 }}>
      <div style={{ fontSize: 12, color: 'var(--cw-text-secondary)', paddingBottom: 8 }}>{active?.id ?? '未选择'}</div>
      <Button variant="tertiary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => navigate('/home')}>重选系统（回首页）</Button>
      <Button variant="tertiary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuOpen(false); setDrawerOpen(true) }}>管理会员</Button>
    </Card>}
    <ProviderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </div>
}

function ProviderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { providers, upsert, remove, probe, activeId, setActiveId } = useProviders()
  const { confirm } = useConfirm()
  const [form] = useForm()
  const [editing, setEditing] = useState<ProviderDescriptor | null>(null)

  const close = () => {
    setEditing(null)
    form.resetFields()
    onClose()
  }

  const submit = async (values: Record<string, unknown>) => {
    const id = editing ? editing.id : String(values.id ?? '').trim()
    if (!editing && !id) return
    upsert({ id, name: String(values.name ?? '').trim(), baseUrl: String(values.baseUrl ?? '').trim() })
    const probed = await probe(id).catch(() => null)
    setEditing(null)
    form.resetFields()
    if (probed?.status === 'online' && !activeId) setActiveId(probed.id)
  }

  return <Modal isOpen={open} onOpenChange={(value) => !value && close()}>
    <Modal.Backdrop />
    <Modal.Container size="lg"><Modal.Dialog>
      <Modal.Header>会员管理</Modal.Header>
      <Modal.Body>
        <p style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>baseUrl 为同源代理前缀，生产环境需在 nginx 侧增加对应转发规则。</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {providers.map((provider) => <div key={provider.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--cw-border)', padding: '8px 0' }}>
            <div><span style={{ color: STATUS_COLOR[provider.status] }}>●</span> <strong>{provider.name}</strong> <code>{provider.id}</code><div style={{ fontSize: 11, color: 'var(--cw-text-secondary)' }}>{provider.baseUrl}</div></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => { setEditing(provider); form.setFieldsValue({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl }) }}>编辑</Button>
              {provider.id !== DEFAULT_PROVIDER.id && <Button size="sm" variant="danger" onClick={async () => {
                if (await confirm({ title: `删除会员 ${provider.name}？`, content: '登记信息与本地偏好将被移除', options: [{ value: true, label: '删除', danger: true }] })) remove(provider.id)
              }}>删除</Button>}
            </div>
          </div>)}
        </div>
        <h4>{editing ? `编辑：${editing.id}` : '登记新会员'}</h4>
        <Form form={form} onFinish={submit}>
          <Form.Item name="id" label="短标识"><Input placeholder="cmd41" disabled={Boolean(editing)} /></Form.Item>
          <Form.Item name="name" label="名称"><Input placeholder="CommAND@41 生产" /></Form.Item>
          <Form.Item name="baseUrl" label="同源代理前缀"><Input placeholder="/p/cmd41/api" /></Form.Item>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={close}>关闭</Button>
        <Button variant="primary" onClick={() => form.submit()}>{editing ? '保存并探测' : '登记并探测'}</Button>
      </Modal.Footer>
      <Modal.CloseTrigger />
    </Modal.Dialog></Modal.Container>
  </Modal>
}
