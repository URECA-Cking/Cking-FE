import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/homeBrowser.jsx', import.meta.url)), name: 'HomeTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.NOTIFICATIONS_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** 외부 요청을 막은 빈 화면에 테스트 번들을 올린다. 설치 안내는 모바일 브라우저에서만 보이므로 iPhone Safari로 위장한다. */
async function screen() {
  const page = await browser.newPage({ userAgent: IPHONE_SAFARI })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/home-test')
  await page.addScriptTag({ content: bundle })
  return { page, errors }
}

test('설치 안내는 기본으로 접혀 있고 설치 방법 보기·닫기로 열고 닫힌다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderInstallBanner())
    const toggle = page.getByRole('button', { name: '설치 방법 보기' })
    await toggle.waitFor()
    await page.getByText('Cking을 앱처럼 쓰기').waitFor()
    const guide = page.locator('#install-manual-guide')
    // hidden 속성은 flex 클래스에 덮여 접히지 않으므로, 속성이 아니라 클래스로 접힘을 표현하는지 본다.
    assert.equal(await guide.evaluate((node) => node.hasAttribute('hidden')), false)
    assert.equal(await guide.evaluate((node) => node.classList.contains('hidden')), true)
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')

    await toggle.click()
    const closeToggle = page.getByRole('button', { name: '설치 방법 닫기' })
    assert.equal(await closeToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(await guide.evaluate((node) => node.classList.contains('hidden')), false)
    assert.equal(await guide.evaluate((node) => node.classList.contains('flex')), true)

    await closeToggle.click()
    assert.equal(await guide.evaluate((node) => node.classList.contains('hidden')), true)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('설치 안내를 닫으면 배너가 사라진다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderInstallBanner())
    await page.getByRole('button', { name: '설치 안내 닫기' }).click()
    await page.waitForFunction(() => document.getElementById('root').children.length === 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('완료 체크는 톤에 따라 색이 바뀌고 크기를 따른다', async () => {
  const { page, errors } = await screen()
  try {
    const mark = page.locator('#root > span')
    await page.evaluate(() => window.renderFilledCheck(undefined, 20))
    await mark.waitFor()
    assert.match(await mark.getAttribute('class'), /bg-emerald-500 text-white/)
    assert.equal(await mark.evaluate((node) => node.style.width), '20px')

    await page.evaluate(() => window.renderFilledCheck('onPrimary', 18))
    await page.waitForFunction(() => document.querySelector('#root > span').className.includes('bg-white'))
    assert.match(await mark.getAttribute('class'), /bg-white text-primary/)
    assert.equal(await mark.evaluate((node) => node.style.width), '18px')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
