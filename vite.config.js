import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Cking-BE에는 CORS 설정이 없어 브라우저에서 http://localhost:8080 을 직접 호출하면
  // preflight/Origin 검사에서 막힌다. 백엔드를 수정하지 않고 해결하기 위해 개발 서버가
  // /api 요청을 그대로 백엔드로 넘겨주는 프록시를 둔다(같은 출처 요청이 되어 CORS 불필요).
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
