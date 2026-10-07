import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** 관리자 개발 서버와 preview 서버의 API 프록시를 구성한다. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'
  const proxy = { '/api': { target, changeOrigin: true } }

  return { plugins: [react()], server: { port: 5174, strictPort: true, proxy }, preview: { port: 5174, strictPort: true, proxy } }
})
