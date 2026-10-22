import { defineConfig } from '@playwright/test'

const baseURL = process.env.E2E_ADMIN_BASE_URL || 'https://dev-admin.cking.co.kr'

/** CI와 분리해 개발자가 필요할 때만 실제 Admin 배포 환경을 점검한다. */
export default defineConfig({
  testDir: './apps/admin/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
