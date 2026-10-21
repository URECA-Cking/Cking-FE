import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 스페이스에 들어오자마자 보이는 이벤트 카드(앞의 두 장)의 배너는 lazy 없이 높은 우선순위로 받고, 나머지는 기존처럼 lazy다(#356).
let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/eventCardBannerBrowser.jsx', import.meta.url)), name: 'EventCardBanner', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

test('앞의 두 카드 배너는 eager·high, 나머지는 lazy다', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await page.route('**/*', (route) => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
    await page.goto('http://localhost/event-card-banner')
    await page.evaluate(() => { window.fetch = async () => new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', data: null, message: 'x' }), { status: 404 }) })
    await page.addScriptTag({ content: bundle })
    await page.getByText('이벤트 14', { exact: true }).waitFor()
    const banners = await page.evaluate(() => [...document.querySelectorAll('img[src*="picsum.photos/seed/event-"]')]
      .map((image) => ({ src: image.getAttribute('src').split('/seed/')[1].split('/')[0], loading: image.getAttribute('loading'), priority: image.getAttribute('fetchpriority') })))
    assert.deepEqual(banners, [
      { src: 'event-11', loading: 'eager', priority: 'high' },
      { src: 'event-12', loading: 'eager', priority: 'high' },
      { src: 'event-13', loading: 'lazy', priority: null },
      { src: 'event-14', loading: 'lazy', priority: null },
    ])
  } finally { await page.close() }
})
