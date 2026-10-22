import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 프로필 편집 뒤로가기: 수정한 내용이 없으면 바로 나가고, 있으면 확인 시트(ConfirmSheet)를 거쳐 나간다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/profileEditBrowser.jsx', import.meta.url)), name: 'ProfileEditLeave', formats: ['iife'] } },
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
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 시트를 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/profile-edit')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '뒤로가기' }).waitFor()
  return page
}

test('수정한 내용이 없으면 확인 없이 바로 나간다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    await page.getByText('마이페이지 화면').waitFor()
  } finally { await page.close() }
})

test('닉네임을 고친 뒤 나가면 확인 시트가 열리고, 취소하면 머물고, 확인하면 나간다', async () => {
  const page = await screen()
  try {
    await page.locator('#nickname').fill('새닉네임')
    await page.getByRole('button', { name: '뒤로가기' }).click()
    const sheet = page.getByRole('dialog', { name: '수정한 내용이 사라져요' })
    await sheet.waitFor()
    await sheet.getByRole('button', { name: '취소' }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.equal(await page.getByText('마이페이지 화면').count(), 0)
    assert.equal(await page.locator('#nickname').inputValue(), '새닉네임')
    await page.getByRole('button', { name: '뒤로가기' }).click()
    await page.getByRole('dialog', { name: '수정한 내용이 사라져요' }).getByRole('button', { name: '나가기', exact: true }).click()
    await page.getByText('마이페이지 화면').waitFor()
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})
