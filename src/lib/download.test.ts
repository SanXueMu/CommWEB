import { describe, expect, it, vi } from 'vitest'
import { triggerDownload, type DownloadDocument } from './download'

/** 极简 document 替身：只覆盖 triggerDownload 用到的能力（无需 jsdom 依赖）。 */
function fakeDoc() {
  const created: { href: string; rel: string; style: { display: string }; clicked: number; removed: number }[] = []
  const doc: DownloadDocument = {
    createElement: () => {
      const node = {
        href: '', rel: '', style: { display: '' }, clicked: 0, removed: 0,
        click() { node.clicked += 1 },
        remove() { node.removed += 1 },
      }
      created.push(node)
      return node
    },
    body: { appendChild: vi.fn() },
  }
  return { doc, created }
}

describe('triggerDownload', () => {
  it('创建隐藏 anchor、点击、并移除（不用 window.open，避免弹窗拦截）', () => {
    const { doc, created } = fakeDoc()

    triggerDownload('/api/files/download?path=%2Fdata%2Fx.zip', doc)

    expect(created).toHaveLength(1)
    const anchor = created[0]
    expect(anchor.href).toBe('/api/files/download?path=%2Fdata%2Fx.zip')
    expect(anchor.rel).toBe('noopener')
    expect(anchor.style.display).toBe('none')
    expect(anchor.clicked).toBe(1)
    expect(anchor.removed).toBe(1)
    expect(doc.body.appendChild).toHaveBeenCalledTimes(1)
  })

  it('href 原样透传（编码后的路径参数不二次编码）', () => {
    const { doc, created } = fakeDoc()

    triggerDownload('/api/files/download?path=%2Fdata%2Fa%20b.zip', doc)

    expect(created[0].href).toBe('/api/files/download?path=%2Fdata%2Fa%20b.zip')
  })
})
