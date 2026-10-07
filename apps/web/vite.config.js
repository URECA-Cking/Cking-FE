import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 로컬에서는 /api를 같은 출처로 요청해 Refresh Cookie와 개발 환경을 단순하게 유지한다.
  // Vite가 요청을 백엔드로 전달하며, 직접 API origin을 쓰는 배포 환경은 백엔드 CORS 설정을 따른다.
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
