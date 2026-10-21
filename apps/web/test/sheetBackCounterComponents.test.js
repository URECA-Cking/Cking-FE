import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 시트를 닫으며 되돌린 history의 popstate가 오지 않아도, 그 뒤의 뒤로가기는 시트의 닫기 처리로 이어진다(#371).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/sheetBackReopenBrowser.jsx', import.meta.url)), name: 'SheetBackCounter', formats: ['iife'] } },
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
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/sheet-back-counter')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  return page
}
const sheet = (page) => page.getByRole('dialog', { name: '뒤로가기 시트' })
const open = async (page) => {
  // 이전 시트의 표시가 남아 있을 수 있어, 새 시트가 항목을 쌓아 표시가 바뀔 때까지 기다린다.
  const previous = await page.evaluate(() => window.history.state?.sheet)
  await page.getByRole('button', { name: '시트 열기' }).click()
  await sheet(page).waitFor()
  await page.waitForFunction((id) => window.history.state?.sheet !== undefined && window.history.state.sheet !== id, previous)
}

test('시트를 닫으며 되돌린 popstate가 오지 않아도, 시간이 지난 뒤의 뒤로가기는 무시되지 않는다', async () => {
  const page = await screen()
  try {
    await open(page)
    // 되돌리기 요청이 popstate 없이 끝나는 상황을 흉내 낸다.
    await page.evaluate(() => { window.history.go = () => {} })
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await sheet(page).waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
    await page.waitForTimeout(1300)
    await open(page)
    await page.goBack()
    await sheet(page).waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 2)
  } finally { await page.close() }
})

test('정상적으로 닫고 다시 열어도 뒤로가기는 바로 시트를 닫는다', async () => {
  const page = await screen()
  try {
    await open(page)
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await sheet(page).waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.history.state?.sheet === undefined)
    await open(page)
    await page.goBack()
    await sheet(page).waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 2)
  } finally { await page.close() }
})
