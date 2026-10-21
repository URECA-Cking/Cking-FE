import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 온보딩 1단계 뒤로가기: 바로 나가지 않고 확인 시트를 거치며, 건너뛰면 완료를 기록한 뒤 가려던 화면으로 간다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/onboardingBrowser.jsx', import.meta.url)), name: 'OnboardingBack', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  // 온보딩 완료 기록 요청 횟수를 센다. 그 밖의 API 요청은 막는다.
  page.completeCalls = 0
  await page.route('**/*', (route) => {
    const request = route.request()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' })
    if (request.method() === 'PUT' && request.url().endsWith('/api/me/onboarding/complete')) {
      page.completeCalls += 1
      return route.fulfill({ status: 204 })
    }
    return route.abort()
  })
  await page.goto('http://localhost/onboarding')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '뒤로가기' }).waitFor()
  return page
}

test('1단계에서 뒤로가기를 누르면 바로 나가지 않고 확인 시트가 열린다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    await page.getByRole('dialog', { name: '온보딩을 건너뛸까요?' }).waitFor()
    assert.equal(await page.getByText('마이페이지 화면').count(), 0)
    assert.equal(page.completeCalls, 0)
  } finally { await page.close() }
})

test('시트에서 취소하면 온보딩에 머물고 완료를 기록하지 않는다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    const sheet = page.getByRole('dialog', { name: '온보딩을 건너뛸까요?' })
    await sheet.getByRole('button', { name: '취소' }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.equal(await page.getByText('마이페이지 화면').count(), 0)
    assert.equal(page.completeCalls, 0)
  } finally { await page.close() }
})

test('시트에서 건너뛰면 완료를 기록하고 가려던 화면으로 간다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    await page.getByRole('dialog', { name: '온보딩을 건너뛸까요?' }).getByRole('button', { name: '건너뛰기', exact: true }).click()
    await page.getByText('마이페이지 화면 (/my-page)').waitFor()
    assert.equal(page.completeCalls, 1)
  } finally { await page.close() }
})
