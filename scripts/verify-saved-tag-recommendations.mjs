// 전용 E2E의 합성 회원/JWT를 stdin으로만 받아 실제 FE → loopback BE를 검증한다.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let input = ''
for await (const chunk of process.stdin) input += chunk
const config = JSON.parse(input)
const target = new URL(config.baseUrl)
assert.equal(target.protocol, 'http:')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
process.chdir(fileURLToPath(new URL('../apps/web', import.meta.url)))
const output = await build({ configFile: false, root: fileURLToPath(new URL('../apps/web', import.meta.url)), plugins: [react()], logLevel: 'silent',
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') },
  build: { write: false, minify: false, lib: {
    entry: fileURLToPath(new URL('../apps/web/test/fixtures/exploreBrowser.jsx', import.meta.url)), name: 'Integration', formats: ['iife'],
  } },
})
const parts = (Array.isArray(output) ? output[0] : output).output
const code = parts.find((part) => part.type === 'chunk').code
const css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
const executablePath = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
let page
const calls = []
try {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1') return route.abort()
    if (url.pathname.startsWith('/api/')) {
      // 브리지의 가상 페이지 Origin을 BE로 보내지 않는다. 실제 인증·API·DB는 그대로 통과한다.
      const headers = { ...request.headers(), Authorization: `Bearer ${config.token}` }
      delete headers.origin
      delete headers.referer
      const response = await route.fetch({ url: `${config.baseUrl}${url.pathname}${url.search}`, headers })
      calls.push({ path: url.pathname, source: url.searchParams.get('source'), method: request.method(), status: response.status() })
      return route.fulfill({ response })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    return route.abort()
  })
  await page.goto('http://127.0.0.1/verify')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: code })
  await page.evaluate((id) => window.renderExplore('/explore/recommend', id), config.memberId)
  await page.getByText('content-owner', { exact: true }).waitFor()
  await page.getByText('content-other', { exact: true }).waitFor()
  assert.equal(await page.getByRole('group', { name: '추천 방식' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '태그로 찾기' }).count(), 0)
  assert.equal(await page.getByRole('link', { name: /content-owner|content-other/ }).count(), 2)
  // 기존 분야 편집에서 실제 저장 → 재조회. 무관 분야에는 0명을 반환한다.
  await page.getByRole('button', { name: '분야 편집' }).click()
  const interests = page.getByRole('group', { name: '관심 분야' })
  await interests.getByRole('button', { name: '음악', exact: true }).click()
  await interests.getByRole('button', { name: '요리·푸드', exact: true }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByText('아직 보여드릴 추천이 없어요. 관심 분야를 골라 보세요.').waitFor()
  assert.equal(await page.getByRole('link', { name: /content-owner|content-other/ }).count(), 0)
  await page.getByRole('button', { name: '분야 편집' }).click()
  await interests.getByRole('button', { name: '요리·푸드', exact: true }).click()
  await interests.getByRole('button', { name: '음악', exact: true }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByText('content-owner', { exact: true }).waitFor()
  // 팔로우 저장은 실제 BE에 보내고 동일한 Context 상태를 화면에 반영한다.
  await page.evaluate(async (ids) => {
    const response = await fetch(`/api/creators/${ids[0]}/follow`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (!response.ok) throw new Error('FOLLOW_FAILED')
    window.setFollowedCreators([ids[0]])
  }, config.creatorIds)
  await page.getByText('content-owner와 비슷한 크리에이터', { exact: true }).waitFor()
  const similar = page.locator('section').filter({ has: page.getByText('content-owner와 비슷한 크리에이터', { exact: true }) })
  await similar.getByText('content-other', { exact: true }).waitFor()
  assert.equal(await similar.getByRole('link').count(), 1)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (config.screenshot) await page.screenshot({ path: config.screenshot, fullPage: true })
  assert.ok(calls.some((c) => c.source === 'INTEREST') && calls.some((c) => c.source === 'FOLLOW'))
  assert.equal(calls.some((c) => c.path === '/api/me/creator-recommendation-events'), false)
  console.log(JSON.stringify({ status: 'passed', checks: ['existing-ui', 'two-results', 'edit-zero', 'edit-restore', 'follow-related', 'no-tracking-id-reuse', 'mobile-width'] }))
} catch (error) {
  if (config.screenshot && page) await page.screenshot({ path: config.screenshot, fullPage: true })
  console.error(JSON.stringify({ error: error.name, calls, text: await page?.locator('body').innerText() }))
  process.exitCode = 1
} finally {
  await browser.close()
}
