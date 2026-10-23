import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 분류체계가 바뀌어 예전 관심 코드가 저장된 회원도 편집·저장할 수 있고, 저장하면 예전 코드가 빠진다.
let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/interestEditorBrowser.jsx', import.meta.url)), name: 'InterestEditor', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen(interestCodes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/interest-editor')
  await page.evaluate(() => {
    window.saves = []
    window.fetch = async (url, options) => {
      if (new URL(String(url), location.href).pathname === '/api/me/interests' && options.method === 'PUT') window.saves.push(JSON.parse(options.body))
      return new Response(JSON.stringify({ code: 'SUCCESS', data: null, message: null }), { status: 200 })
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((codes) => window.renderEditor(codes), interestCodes)
  return page
}

test('예전 코드만 저장된 회원이 편집을 열어 그대로 저장하면 예전 코드를 정리한다', async () => {
  const page = await screen(['OLD_A', 'OLD_B', 'OLD_C'])
  try {
    await page.getByText('관심 분야를 고르면 추천이 더 정확해져요').waitFor()
    await page.getByRole('button', { name: '분야 편집' }).click()
    await page.getByText('0/3개 선택').waitFor()
    // 예전 코드는 개수에 들어가지 않아 새 분야를 고를 수 있다.
    assert.equal(await page.getByRole('button', { name: '음악' }).isDisabled(), false)

    await page.getByRole('button', { name: '저장' }).click()
    await page.waitForFunction(() => window.saves.length === 1)
    assert.deepEqual(await page.evaluate(() => window.saves), [{ taxonomyVersion: 'v2', interestCodes: [] }])
  } finally { await page.close() }
})

test('예전 코드가 섞여 있으면 현재 코드만 남기고 저장한다', async () => {
  const page = await screen(['MUSIC', 'OLD_A'])
  try {
    await page.getByRole('button', { name: '분야 편집' }).click()
    await page.getByText('1/3개 선택').waitFor()
    await page.getByRole('button', { name: '저장' }).click()
    await page.waitForFunction(() => window.saves.length === 1)
    assert.deepEqual(await page.evaluate(() => window.saves), [{ taxonomyVersion: 'v2', interestCodes: ['MUSIC'] }])
  } finally { await page.close() }
})

test('현재 코드만 저장돼 있고 바꾸지 않았으면 저장 요청을 보내지 않는다', async () => {
  const page = await screen(['MUSIC', 'GAME'])
  try {
    await page.getByRole('button', { name: '분야 편집' }).click()
    await page.getByText('2/3개 선택').waitFor()
    await page.getByRole('button', { name: '저장' }).click()
    await page.getByRole('button', { name: '분야 편집' }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.saves), [])
  } finally { await page.close() }
})
