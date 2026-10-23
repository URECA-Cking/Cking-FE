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
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/myTicketsEmptyBrowser.jsx', import.meta.url)), name: 'MyTicketsEmptyTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

test('도킹한 크리에이터가 없으면 크리에이터 찾기 링크로 탐색 탭에 보낸다', async () => {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.route('**/*', (route) => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
    await page.goto('http://localhost/my-tickets')
    await page.addScriptTag({ content: bundle })
    await page.evaluate(() => window.renderMyTickets())

    await page.getByText('아직 도킹한 크리에이터가 없어요.').waitFor()
    assert.equal(await page.getByText('도킹할 크리에이터 고르기').count(), 0)
    await page.getByRole('link', { name: '도킹할 크리에이터 찾기' }).click()
    await page.locator('#arrived').waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
