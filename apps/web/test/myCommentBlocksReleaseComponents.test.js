import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 차단 해제는 window.confirm이 아니라 확인 시트(ConfirmSheet)로 확인한다: 취소하면 요청이 없고, 확인하면 해제한다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/myCommentBlocksBrowser.jsx', import.meta.url)), name: 'BlocksRelease', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const block = { sanctionId: 31, memberId: 9, memberName: '열혈팬', startedAt: '2099-01-01T00:00:00Z', endsAt: '2099-02-01T00:00:00Z', releasedAt: null, active: true }

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 시트를 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/blocks-release')
  await page.addStyleTag({ content: css })
  await page.evaluate((item) => {
    window.releaseCalls = []
    window.released = false
    window.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname
      if ((init.method ?? 'GET') === 'POST' && path === '/api/creator/comment-blocks/31/release') {
        window.releaseCalls.push(path)
        window.released = true
        return new Response(JSON.stringify({ code: 'SUCCESS', data: { ...item, active: false, releasedAt: '2099-01-02T00:00:00Z' } }), { status: 200 })
      }
      if (path === '/api/creator/comment-blocks') {
        const items = window.released ? [] : [item]
        return new Response(JSON.stringify({ code: 'SUCCESS', data: { items, page: 0, hasNext: false } }), { status: 200 })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, block)
  await page.addScriptTag({ content: bundle })
  await page.getByText('열혈팬').waitFor()
  return page
}

test('해제를 누르면 확인 시트가 열리고 취소하면 요청이 가지 않는다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '해제', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '열혈팬의 차단을 해제할까요?' })
    await sheet.waitFor()
    await sheet.getByRole('button', { name: '취소' }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.releaseCalls), [])
    assert.equal(await page.getByText('열혈팬').count(), 1)
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})

test('시트에서 차단 해제를 확인하면 해제 요청을 보내고 목록에서 뺀다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '해제', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '열혈팬의 차단을 해제할까요?' })
    await sheet.getByRole('button', { name: '차단 해제', exact: true }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.releaseCalls), ['/api/creator/comment-blocks/31/release'])
    await page.getByText('차단 중인 회원이 없어요.').waitFor()
    assert.deepEqual(await page.evaluate(() => window.toasts), ['차단을 해제했어요.'])
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})
