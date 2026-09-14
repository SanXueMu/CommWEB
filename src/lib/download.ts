/** 触发浏览器下载。
 *
 *  为什么不用 `window.open(url)`：打包是**异步**的（先请求服务端生成 zip，再下载），
 *  await 之后用户手势上下文已丢失，`window.open` 会被弹窗拦截器静默拦掉
 *  （2026-09-14 线上：提示「已按原目录结构打包 137 个文件」但没有任何下载）。
 *  程序化创建 `<a>` 并 click 不受弹窗拦截影响；服务端 `/files/download` 带
 *  `Content-Disposition: attachment`，跨源也会直接落盘。
 */

/** 只用到这几个能力（便于在 node 环境单测，无需 jsdom）。 */
export interface DownloadDocument {
  createElement(tag: string): {
    href: string
    rel: string
    style: { display: string }
    click(): void
    remove(): void
  }
  body: { appendChild(node: unknown): void }
}

export function triggerDownload(url: string, doc?: DownloadDocument): void {
  const target = doc ?? (globalThis.document as unknown as DownloadDocument)
  const anchor = target.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  target.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
