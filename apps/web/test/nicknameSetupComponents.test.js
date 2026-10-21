import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/nicknameSetupBrowser.jsx', import.meta.url)), name: 'NicknameSetup', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})

test.after(async () => { await browser?.close() })

/** 닉네임이 없는 로그인 계정으로 요청한 경로를 브라우저에서 연다. */
async function screen(path) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto(`http://localhost${path}`)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '뒤로가기' }).waitFor()
  return page
}

for (const path of ['/my-page', '/events/16']) {
  test(`닉네임 미설정 계정은 ${path} 직접 진입 시 프로필 설정으로 이동한다`, async () => {
    const page = await screen(path)
    try {
      assert.equal(await page.getByText('닉네임을 정해주세요').count(), 1)
      assert.equal(await page.getByRole('button', { name: '나중에 할게요' }).count(), 0)
      assert.equal(await page.evaluate(() => window.logoutCalls), 0)
    } finally { await page.close() }
  })
}

test('최초 설정에서 뒤로 가기는 확인 후 로그아웃한다', async () => {
  const page = await screen('/my-page')
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    const sheet = page.getByRole('dialog', { name: '닉네임 설정을 종료할까요?' })
    await sheet.waitFor()
    await sheet.getByRole('button', { name: '취소' }).click()
    assert.equal(await page.evaluate(() => window.logoutCalls), 0)
    await page.getByRole('button', { name: '뒤로가기' }).click()
    await page.getByRole('dialog', { name: '닉네임 설정을 종료할까요?' }).getByRole('button', { name: '로그아웃' }).click()
    await page.getByRole('button', { name: '구글로 시작하기' }).waitFor()
    assert.equal(await page.evaluate(() => window.logoutCalls), 1)
  } finally { await page.close() }
})
