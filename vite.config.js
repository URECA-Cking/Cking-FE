import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 백엔드 컨트롤러가 이미 /api 접두사로 매핑되어 있어 경로를 그대로 전달한다.
    // 예: fetch('/api/events') -> http://localhost:8080/api/events
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
