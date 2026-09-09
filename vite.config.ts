import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// 唯一出站通道：/api 经 proxy 到 CommAND，页面永不直连工具或数据库
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.COMMAND_API ?? 'http://127.0.0.1:8800',
        changeOrigin: true,
      },
    },
  },
})
