import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// 唯一出站通道：/api 经 proxy 到 CommAND，页面永不直连工具或数据库
// Transfer 会员代理：VITE_DEV_PROVIDERS="id1=url1,id2=url2" → /p/{id}/api/* 转发到对应会员
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProviders = (env.VITE_DEV_PROVIDERS ?? '')
    .split(',')
    .map((pair) => pair.split('='))
    .filter((pair) => pair.length === 2 && pair[0].trim() && pair[1].trim())
    .map(([id, url]) => [id.trim(), url.trim()] as const)

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.COMMAND_API ?? 'http://127.0.0.1:8800',
          changeOrigin: true,
        },
        ...Object.fromEntries(
          devProviders.map(([id, url]) => [
            `/p/${id}`,
            {
              target: url,
              changeOrigin: true,
              rewrite: (path: string) => path.replace(new RegExp(`^/p/${id}`), ''),
            },
          ]),
        ),
      },
    },
  }
})
