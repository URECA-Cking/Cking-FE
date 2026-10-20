import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시글·일정 작성 시트: 작성한 내용이 없으면 바로 닫히고, 있으면 확인 시트(ConfirmSheet)를 거쳐 닫는다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/editorSheetsBrowser.jsx', import.meta.url)), name: 'EditorSheets', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const CONFIRM_TITLE = '작성 중인 내용이 사라져요'

async function screen(kind) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 시트를 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/editor-sheets')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((value) => window.renderEditor(value), kind)
  return page
}
const closeButton = (page) => page.getByRole('button', { name: '닫기', exact: true })

for (const [kind, sheetName, field] of [['post', '게시글 작성', '내용'], ['schedule', '일정 등록', '제목']]) {
  test(`${sheetName}: 작성한 내용이 없으면 확인 없이 바로 닫힌다`, async () => {
    const page = await screen(kind)
    try {
      await page.getByRole('dialog', { name: sheetName }).waitFor()
      await closeButton(page).first().click()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 1)
    } finally { await page.close() }
  })

  test(`${sheetName}: 작성 중에 닫으면 확인 시트가 열리고, 취소하면 그대로 남고, 확인하면 닫힌다`, async () => {
    const page = await screen(kind)
    try {
      const editor = page.getByRole('dialog', { name: sheetName })
      await editor.waitFor()
      await editor.locator(field === '내용' ? 'textarea' : 'input[type="text"]').first().fill('작성 중인 글')
      await closeButton(page).first().click()
      const confirm = page.getByRole('dialog', { name: CONFIRM_TITLE })
      await confirm.waitFor()
      await confirm.getByRole('button', { name: '취소' }).click()
      await confirm.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 0)
      await editor.waitFor()
      await closeButton(page).first().click()
      await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '버리고 닫기', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 1)
      assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
    } finally { await page.close() }
  })
}
