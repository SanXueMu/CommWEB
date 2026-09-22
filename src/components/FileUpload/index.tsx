/** 通用上传组件：POST /api/files → 返回服务端路径，受控用法 value/onChange。 */

import { useRef, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/ui'

export function FileUpload({
  value,
  onChange,
  accept,
}: {
  value?: string
  onChange?: (path: string) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const result = await api.uploadFile(file)
      onChange?.(result.path)
    } catch (uploadError) {
      setError(`上传失败：${(uploadError as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file) void upload(file)
        }}
        style={{ background: 'var(--cw-fill)', border: '1px dashed var(--cw-border)', borderRadius: 8, padding: 20, textAlign: 'center' }}
      >
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }} />
        <Button variant="secondary" isDisabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? '上传中...' : '选择文件'}
        </Button>
        <div style={{ color: 'var(--cw-text-secondary)', fontSize: 13, marginTop: 8 }}>或拖拽文件上传（≤200MB）</div>
      </div>
      {error && <div role="alert" style={{ color: 'var(--cw-danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      {value && (
        <code style={{ display: 'block', fontSize: 12, marginTop: 6 }}>{value}</code>
      )}
    </div>
  )
}
