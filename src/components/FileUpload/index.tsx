/** 通用上传组件：POST /api/files → 返回服务端路径，受控用法 value/onChange。 */

import { InboxOutlined } from '@ant-design/icons'
import { Typography, Upload, message } from 'antd'
import { api } from '@/api/client'

export function FileUpload({
  value,
  onChange,
  accept,
}: {
  value?: string
  onChange?: (path: string) => void
  accept?: string
}) {
  return (
    <div>
      <Upload.Dragger
        accept={accept}
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          try {
            const result = await api.uploadFile(file as File)
            onChange?.(result.path)
            message.success(`已上传：${result.name}`)
            onSuccess?.(result)
          } catch (error) {
            message.error(`上传失败：${(error as Error).message}`)
            onError?.(error as Error)
          }
        }}
        style={{ background: '#fafafa' }}
      >
        <p style={{ margin: '12px 0 4px' }}>
          <InboxOutlined style={{ fontSize: 28, color: '#202753' }} />
        </p>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          点击或拖拽文件上传（≤200MB，上传后得到服务端路径）
        </Typography.Text>
      </Upload.Dragger>
      {value && (
        <Typography.Text code style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          {value}
        </Typography.Text>
      )}
    </div>
  )
}
