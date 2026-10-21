import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 홈 새 게시물 카드로 연 상세를 직접 닫으면 스페이스가 아니라 온 곳(홈)으로 돌아가고, 목록에서 연 상세는 그대로 상세만 닫힌다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsFeedEntryBrowser.jsx', import.meta.url)), name: 'PostsFeedEntry', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const post = { postId: 5, content: '홈에서 연 게시글', visibility: 'PUBLIC', locked: false, imageCount: 0, images: [], likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

async function screen(query, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto(`http://localhost/posts-feed-entry${query}`)
  await page.addStyleTag({ content: css })
  await page.evaluate((item) => {
    window.fetch = async (url) => {
      const path = new URL(url).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creators/13/posts') return reply({ items: [item], page: 0, hasNext: false, totalPages: 1 })
      if (path === '/api/creators/13/posts/5') return reply(item)
      if (path.endsWith('/comments')) return reply({ items: [], page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, post)
  await page.addScriptTag({ content: bundle })
  return page
}

test('홈 카드로 열린 상세는 열린 뒤 initialPostId를 한 번 비운다', async () => {
  const page = await screen('?from=feed')
  try {
    await page.getByRole('dialog', { name: '게시글 상세' }).waitFor()
    assert.equal(await page.evaluate(() => window.openedCalls), 1)
  } finally { await page.close() }
})

test('홈 카드로 연 상세를 뒤로 화살표로 닫으면 스페이스가 아니라 온 곳으로 돌아간다', async () => {
  const page = await screen('?from=feed')
  try {
    const detail = page.getByRole('dialog', { name: '게시글 상세' })
    await detail.waitFor()
    await detail.getByRole('button', { name: '닫기' }).first().click()
    assert.equal(await page.evaluate(() => window.leaveCalls), 1)
    // 이동이 끝날 때까지 상세를 그대로 두므로 스페이스(목록)가 먼저 드러나지 않는다.
    assert.equal(await detail.count(), 1)
  } finally { await page.close() }
})

test('데스크톱 X 버튼으로 닫아도 이동은 한 번만 일어나고 이동이 끝날 때까지 상세가 남는다', async () => {
  const page = await screen('?from=feed', { width: 1024, height: 768 })
  try {
    const detail = page.getByRole('dialog', { name: '게시글 상세' })
    await detail.waitFor()
    // 데스크톱에서는 X 버튼만 보이는 닫기 버튼이다. 클릭이 배경까지 전달되면 두 번째 호출이 상세를 먼저 없앤다.
    await detail.getByRole('button', { name: '닫기' }).click()
    assert.equal(await page.evaluate(() => window.leaveCalls), 1)
    assert.equal(await detail.count(), 1)
  } finally { await page.close() }
})

test('배경을 눌러 닫아도 홈 카드로 연 상세는 온 곳으로 돌아간다', async () => {
  const page = await screen('?from=feed', { width: 1024, height: 768 })
  try {
    const detail = page.getByRole('dialog', { name: '게시글 상세' })
    await detail.waitFor()
    await detail.click({ position: { x: 5, y: 5 } })
    assert.equal(await page.evaluate(() => window.leaveCalls), 1)
    assert.equal(await detail.count(), 1)
  } finally { await page.close() }
})

test('목록에서 직접 연 상세를 닫으면 온 곳으로 이동하지 않고 상세만 닫힌다', async () => {
  const page = await screen('')
  try {
    await page.getByRole('button', { name: /^게시글 홈에서 연 게시글/ }).click()
    const detail = page.getByRole('dialog', { name: '게시글 상세' })
    await detail.waitFor()
    await detail.getByRole('button', { name: '닫기' }).first().click()
    await detail.waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.leaveCalls), 0)
  } finally { await page.close() }
})
