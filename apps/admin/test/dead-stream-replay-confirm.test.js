import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

// Dead Stream 재처리는 window.confirm이 아니라 확인 모달(ConfirmModal)로 확인한다: 취소하면 요청이 없고, 확인하면 재처리한다.
let bundle
let browser

test.before(async () => {
  const output = await build({
    configFile: false,
    plugins: [react()],
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/deadStreamsBrowser.jsx', import.meta.url)), name: 'DeadStreamReplay', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const item = { id: 41, streamType: 'EARN', resolutionStatus: 'UNRESOLVED', retryCount: 2, failureReason: '일시 오류', eventId: 5, memberId: 9, lastFailedAt: '2026-10-20T01:00:00Z', createdAt: '2026-10-20T00:00:00Z' }

async function screen() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 모달을 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/dead-streams')
  await page.evaluate((record) => {
    window.replayCalls = []
    window.replayed = false
    window.fetch = async (url, init = {}) => {
      const path = new URL(url, location.href).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if ((init.method ?? 'GET') === 'POST' && path === '/api/admin/dead-streams/41/replay') {
        window.replayCalls.push(path)
        window.replayed = true
        return reply(null)
      }
      if (path === '/api/admin/dead-streams') {
        return reply({ items: window.replayed ? [] : [record], page: 0, size: 20, totalElements: window.replayed ? 0 : 1, totalPages: 1, hasNext: false })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, item)
  await page.addScriptTag({ content: bundle })
  await page.getByText('메시지 #41').waitFor()
  return page
}

test('다시 처리를 누르면 확인 모달이 열리고 취소하면 요청이 가지 않는다', async () => {
  const page = await screen()
  try {
    await page.locator('article').getByRole('button', { name: /다시 처리/ }).click()
    const modal = page.getByRole('dialog')
    await modal.getByText('데드 메시지를 다시 처리할까요?').waitFor()
    await modal.getByRole('button', { name: '취소' }).click()
    await modal.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.replayCalls), [])
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})

test('모달에서 다시 처리를 확인하면 재처리하고 목록을 새로 읽는다', async () => {
  const page = await screen()
  try {
    await page.locator('article').getByRole('button', { name: /다시 처리/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: '다시 처리', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.replayCalls), ['/api/admin/dead-streams/41/replay'])
    await page.getByText('처리할 데드 메시지가 없어요.').waitFor()
    assert.deepEqual(await page.evaluate(() => window.toasts), ['데드 메시지 #41을 다시 처리했어요.'])
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})
