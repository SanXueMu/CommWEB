/** 会话菜单（蓝图05 M1）：本页会话信息 + 回首页重选；管理抽屉含登记/编辑/删除/探测。 */

import { App as AntApp, Badge, Button, Drawer, Dropdown, Form, Input, Modal, Space, Typography } from 'antd'
import { ApiOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProviders } from '@/transfer/context'
import { DEFAULT_PROVIDER } from '@/transfer/protocol'
import type { ProviderDescriptor } from '@/transfer/protocol'

const STATUS_COLOR: Record<ProviderDescriptor['status'], string> = {
  online: '#52c41a',
  offline: '#ff4d4f',
  degraded: '#faad14',
  unknown: '#d9d9d9',
}

interface ProviderFormValues {
  id: string
  name: string
  baseUrl: string
}

/** 主形态：页眉会话按钮；asLink：首页底部的管理入口（无下拉）。 */
export function ProviderMenu({ asLink = false }: { asLink?: boolean }) {
  const navigate = useNavigate()
  const { providers, activeId } = useProviders()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const active = providers.find((p) => p.id === activeId)

  if (asLink) {
    return (
      <>
        <Button type="link" size="small" icon={<SettingOutlined />} style={{ padding: 0, height: 'auto' }} onClick={() => setDrawerOpen(true)}>
          管理会员
        </Button>
        <ProviderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </>
    )
  }

  return (
    <Space size={4}>
      <Dropdown
        menu={{
          items: [
            {
              key: 'session',
              label: (
                <Space size={6}>
                  <Badge color={STATUS_COLOR[active?.status ?? 'unknown']} />
                  <span>{active?.name ?? '未选择'}</span>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>{active?.id ?? '—'}</Typography.Text>
                </Space>
              ),
              disabled: true,
            },
            { type: 'divider' as const },
            { key: 'reselect', icon: <LogoutOutlined />, label: '重选系统（回首页）', onClick: () => navigate('/home') },
            { key: 'manage', icon: <SettingOutlined />, label: '管理会员', onClick: () => setDrawerOpen(true) },
          ],
        }}
      >
        <Button size="small" icon={<ApiOutlined />}>
          {active?.name ?? '选择系统'}
        </Button>
      </Dropdown>
      <ProviderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Space>
  )
}

function ProviderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { providers, upsert, remove, probe, activeId, setActiveId } = useProviders()
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<ProviderFormValues>()
  const [editing, setEditing] = useState<ProviderDescriptor | null>(null)

  const close = () => {
    setEditing(null)
    form.resetFields()
    onClose()
  }

  const submit = async (values: ProviderFormValues) => {
    const id = editing ? editing.id : values.id.trim()
    if (!editing && !id) {
      message.error('请填写短标识')
      return
    }
    upsert({ id, name: values.name.trim(), baseUrl: values.baseUrl.trim() })
    const probed = await probe(id).catch(() => null)
    setEditing(null)
    form.resetFields()
    if (probed?.status === 'online') {
      message.success(`已保存并在线：${probed.name}`)
      if (!activeId) setActiveId(probed.id)
    } else {
      message.warning('已保存但探测未通过——请确认代理前缀已配置（dev 需重启 vite）')
    }
  }

  return (
    <Drawer title="会员管理（Transfer · 登记委托展示的系统）" open={open} onClose={close} width={480}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        baseUrl 为同源代理前缀（如 /p/cmd41/api），生产环境需在 nginx 侧增加对应转发规则。
      </Typography.Paragraph>
      {providers.map((p) => (
        <Space key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <Space size={8}>
            <Badge color={STATUS_COLOR[p.status]} />
            <Typography.Text strong={p.id === activeId}>{p.name}</Typography.Text>
            <Typography.Text code style={{ fontSize: 11 }}>{p.id}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{p.baseUrl}</Typography.Text>
          </Space>
          <Space size={4}>
            <Button
              size="small"
              type="text"
              onClick={() => {
                setEditing(p)
                form.setFieldsValue({ id: p.id, name: p.name, baseUrl: p.baseUrl })
              }}
            >
              编辑
            </Button>
            {p.id !== DEFAULT_PROVIDER.id && (
              <Button
                size="small"
                danger
                onClick={() =>
                  Modal.confirm({
                    title: `删除会员 ${p.name}？`,
                    content: '登记信息与本地偏好将被移除',
                    okText: '删除',
                    okButtonProps: { danger: true },
                    onOk: () => remove(p.id),
                  })
                }
              >
                删除
              </Button>
            )}
          </Space>
        </Space>
      ))}
      <Typography.Title level={5} style={{ marginTop: 16 }}>{editing ? `编辑：${editing.id}` : '登记新会员'}</Typography.Title>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="id" label="短标识" rules={[{ required: !editing, message: '必填（字母数字）' }]}>
          <Input placeholder="cmd41" disabled={Boolean(editing)} />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
          <Input placeholder="CommAND@41 生产" />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="同源代理前缀"
          rules={[{ required: true, message: '必填' }]}
          extra="dev 代理在 .env 的 VITE_DEV_PROVIDERS 声明后重启；生产在 nginx 配置 location"
        >
          <Input placeholder="/p/cmd41/api" />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">{editing ? '保存并探测' : '登记并探测'}</Button>
          {editing && <Button onClick={() => { setEditing(null); form.resetFields(); }}>取消编辑</Button>}
        </Space>
      </Form>
    </Drawer>
  )
}
