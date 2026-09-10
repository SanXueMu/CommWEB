/** 会员菜单：Transfer 面孔——当前会员下拉切换 + 登记管理抽屉。 */

import { App as AntApp, Badge, Button, Drawer, Dropdown, Form, Input, Modal, Space, Typography } from 'antd'
import { ApiOutlined, PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useProviders } from '@/transfer/context'
import { DEFAULT_PROVIDER } from '@/transfer/protocol'
import type { ProviderDescriptor } from '@/transfer/protocol'

const STATUS_COLOR: Record<ProviderDescriptor['status'], string> = {
  online: '#52c41a',
  offline: '#ff4d4f',
  degraded: '#faad14',
  unknown: '#d9d9d9',
}

function statusLabel(status: ProviderDescriptor['status']): string {
  return { online: '在线', offline: '离线', degraded: '降级', unknown: '探测中' }[status]
}

export function ProviderMenu() {
  const { providers, activeId, setActiveId, probe } = useProviders()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const active = providers.find((p) => p.id === activeId) ?? providers[0]

  return (
    <Space size={4}>
      <Dropdown
        menu={{
          items: [
            ...providers.map((p) => ({
              key: p.id,
              label: (
                <Space size={6}>
                  <Badge color={STATUS_COLOR[p.status]} text={null} />
                  <span>{p.name}</span>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {p.id === DEFAULT_PROVIDER.id ? '' : statusLabel(p.status)}
                  </Typography.Text>
                </Space>
              ),
              onClick: async () => {
                if (p.id === activeId) return
                const probed = await probe(p.id).catch(() => p)
                if (probed.status === 'online') setActiveId(p.id)
                else Modal.warning({ title: '会员不可达', content: `${p.name}（${p.baseUrl}）探测失败，请检查地址与代理配置` })
              },
            })),
            { type: 'divider' as const },
            {
              key: 'manage',
              icon: <PlusOutlined />,
              label: '管理会员',
              onClick: () => setDrawerOpen(true),
            },
          ],
        }}
      >
        <Button size="small" icon={<ApiOutlined />}>
          {active?.name ?? DEFAULT_PROVIDER.name}
        </Button>
      </Dropdown>
      <ProviderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Space>
  )
}

function ProviderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { providers, upsert, remove, probe, activeId, setActiveId } = useProviders()
  const { message } = AntApp.useApp()
  const [form] = Form.useForm()

  const submit = async (values: { id: string; name: string; baseUrl: string }) => {
    upsert({ id: values.id.trim(), name: values.name.trim(), baseUrl: values.baseUrl.trim() })
    const probed = await probe(values.id.trim()).catch(() => null)
    form.resetFields()
    if (probed?.status === 'online') {
      message.success(`会员已登记并在线：${probed.name}`)
      setActiveId(probed.id)
    } else {
      message.warning('会员已登记但探测未通过——请确认代理前缀已配置（dev 需重启 vite）')
    }
  }

  return (
    <Drawer title="会员管理（Transfer · 登记委托展示的系统）" open={open} onClose={onClose} width={480}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        登记满足 CommWEB 协议的系统。baseUrl 为同源代理前缀（如 /p/cmd41/api），生产环境需在 nginx 侧增加对应转发规则。
      </Typography.Paragraph>
      {providers.map((p) => (
        <Space key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <Space size={8}>
            <Badge color={STATUS_COLOR[p.status]} />
            <Typography.Text strong={p.id === activeId}>{p.name}</Typography.Text>
            <Typography.Text code style={{ fontSize: 11 }}>{p.id}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{p.baseUrl}</Typography.Text>
          </Space>
          {p.id !== DEFAULT_PROVIDER.id && (
            <Button size="small" danger onClick={() => remove(p.id)}>
              删除
            </Button>
          )}
        </Space>
      ))}
      <Typography.Title level={5} style={{ marginTop: 16 }}>登记新会员</Typography.Title>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="id" label="短标识" rules={[{ required: true, message: '必填（字母数字）' }]}>
          <Input placeholder="cmd41" />
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
        <Button type="primary" htmlType="submit">
          登记并探测
        </Button>
      </Form>
    </Drawer>
  )
}
