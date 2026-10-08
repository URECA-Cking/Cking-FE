import { expect, test } from '@playwright/test'

const loginId = process.env.E2E_ADMIN_LOGIN_ID
const password = process.env.E2E_ADMIN_PASSWORD
const apiBaseURL = process.env.E2E_ADMIN_API_BASE_URL || 'https://dev-api.cking.co.kr'
const apiHost = new URL(apiBaseURL).hostname

test.describe.configure({ mode: 'serial' })
test.skip(!loginId || !password, 'E2E_ADMIN_LOGIN_ID와 E2E_ADMIN_PASSWORD가 필요합니다.')

test('관리자 로그인, Refresh Cookie 세션 복원, 로그아웃을 실제 배포 환경에서 확인한다', async ({ page, context }, testInfo) => {
  await page.goto('/login')
  await page.getByLabel('관리자 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('관리자 콘솔')).toBeVisible()

  await page.evaluate(() => sessionStorage.removeItem('cking.admin.accessToken'))
  const refreshResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.hostname === apiHost && url.pathname === '/api/admin/auth/refresh' && response.request().method() === 'POST'
  })
  await page.reload()
  await refreshResponse
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('관리자 콘솔')).toBeVisible()

  const cookies = await context.cookies()
  const cookieMetadata = cookies.map(({ name, domain, path, sameSite, secure, httpOnly }) => ({ name, domain, path, sameSite, secure, httpOnly }))
  const refreshCookie = cookies.find((cookie) => cookie.name === 'admin_refresh_token')
  expect(refreshCookie, '관리자 Refresh Cookie가 API Origin에 있어야 합니다.').toBeDefined()
  expect(refreshCookie.httpOnly).toBe(true)
  expect(refreshCookie.secure).toBe(true)
  await testInfo.attach('admin-refresh-cookie-metadata.json', {
    body: JSON.stringify(cookieMetadata, null, 2),
    contentType: 'application/json',
  })

  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(async () => (await context.cookies(apiBaseURL)).some((cookie) => cookie.name === 'admin_refresh_token')).toBe(false)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
})
