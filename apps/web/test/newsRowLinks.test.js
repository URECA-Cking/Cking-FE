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
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/newsRowBrowser.jsx', import.meta.url)), name: 'NewsRowTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen(creators) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/')
  await page.addScriptTag({ content: bundle })
  await page.evaluate((list) => window.renderNewsRow(list), creators)
  return { page, errors }
}

test('도킹한 크리에이터가 없으면 소식 줄 안내를 눌러 탐색 탭으로 간다', async () => {
  const { page, errors } = await screen([])
  try {
    await page.getByRole('link', { name: /좋아하는 크리에이터에 도킹해 보세요/ }).click()
    await page.locator('#arrived').waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('도킹한 크리에이터가 있으면 소식 줄 끝의 크리에이터 추가를 눌러 탐색 탭으로 간다', async () => {
  const { page, errors } = await screen([{ creatorId: 1, name: '하늘', avatar: null, verified: true }])
  try {
    await page.getByRole('link', { name: '크리에이터 추가' }).click()
    await page.locator('#arrived').waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
