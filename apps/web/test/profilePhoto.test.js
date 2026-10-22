import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

const a = 'https://images.test/a.svg'
const b = 'https://images.test/b.svg'
const profile = 'https://images.test/profile.svg'
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />'
let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/profilePhotoBrowser.jsx', import.meta.url)), name: 'ProfilePhotoTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((item) => item.type === 'chunk').code
  const paths = [process.env.PROFILE_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})

test.after(async () => { await browser?.close() })

async function screen() {
  const page = await browser.newPage()
  await page.route('**/*', (route) => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    if (route.request().url().startsWith('https://images.test/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg })
    return route.abort()
  })
  await page.goto('http://localhost/profile-photo-test')
  await page.addScriptTag({ content: bundle })
  return page
}

async function renderPhoto(page, src) {
  await page.evaluate((value) => window.renderProfilePhoto(value), src)
  if (src) await page.locator('#root img').waitFor()
  else await page.locator('#root svg').waitFor()
}

async function failImage(page) {
  await page.locator('#root img').evaluate((image) => image.dispatchEvent(new Event('error')))
}

test('사진 URL이 없으면 즉시 사람 아이콘을 표시한다', async () => {
  const page = await screen()
  try {
    for (const src of [null, '']) {
      await renderPhoto(page, src)
      assert.equal(await page.locator('#root img').count(), 0)
      assert.equal(await page.locator('#root svg').count(), 1)
    }
  } finally { await page.close() }
})

test('실패한 프로필 URL도 다른 URL을 거쳐 돌아오면 다시 시도한다', async () => {
  const page = await screen()
  try {
    await renderPhoto(page, a)
    await failImage(page)
    await page.locator('#root img').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('#root svg').count(), 1)
    await renderPhoto(page, b)
    assert.equal(await page.locator('#root img').getAttribute('src'), b)
    await renderPhoto(page, a)
    assert.equal(await page.locator('#root img').getAttribute('src'), a)
  } finally { await page.close() }
})

test('배너 실패 시 프로필 사진을 사용하지 않고 사람 아이콘을 표시한다', async () => {
  const page = await screen()
  try {
    await page.evaluate(([src, profileSrc]) => window.renderCreatorBanner(src, profileSrc), [a, profile])
    await page.locator('#root img').waitFor()
    await failImage(page)
    await page.locator('#root img').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('#root img').count(), 0)
    assert.equal(await page.locator(`#root img[src="${profile}"]`).count(), 0)
    assert.equal(await page.locator('#root svg').count(), 1)
    assert.equal(await page.locator('#root svg').isVisible(), true)
  } finally { await page.close() }
})

test('배너 실패 시 사람 아이콘을 표시하고 URL이 바뀌거나 돌아오면 다시 시도한다', async () => {
  const page = await screen()
  try {
    await page.evaluate(([src, profileSrc]) => window.renderCreatorBanner(src, profileSrc), [a, profile])
    await page.locator('#root img').waitFor()
    await failImage(page)
    await page.locator('#root img').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('#root img').count(), 0)
    assert.equal(await page.locator(`#root img[src="${profile}"]`).count(), 0)
    assert.equal(await page.locator('#root svg').isVisible(), true)
    await page.evaluate(([src, profileSrc]) => window.renderCreatorBanner(src, profileSrc), [b, profile])
    await page.waitForFunction((expected) => document.querySelector('#root img')?.getAttribute('src') === expected, b)
    await page.waitForFunction(() => document.querySelector('#root img')?.naturalWidth > 0)
    await page.evaluate(([src, profileSrc]) => window.renderCreatorBanner(src, profileSrc), [a, profile])
    await page.waitForFunction((expected) => document.querySelector('#root img')?.getAttribute('src') === expected, a)
    await page.waitForFunction(() => document.querySelector('#root img')?.naturalWidth > 0)
  } finally { await page.close() }
})
