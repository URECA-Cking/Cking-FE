import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 홈 새 게시물 카드는 postId를 openPostId로 넘기고, 게시글 탭은 initialPostId가 있으면 그 상세를 한 번 연다(#300).
let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/homePostLinkBrowser.jsx', import.meta.url)), name: 'HomePostLink', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/home-post-link')
  await page.evaluate(() => {
    window.requested = []
    window.fetch = async (url) => {
      const path = new URL(url).pathname
      window.requested.push(path)
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      const item = (postId) => ({ postId, content: `게시글 ${postId}`, visibility: 'PUBLIC', locked: false, imageCount: 0, images: [], likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' })
      if (path === '/api/creators/13/posts') return reply({ items: [item(1), item(2)], page: 0, hasNext: false, totalPages: 1 })
      if (/^\/api\/creators\/13\/posts\/\d+$/.test(path)) return reply(item(Number(path.split('/').pop())))
      if (path.endsWith('/comments')) return reply({ items: [], page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  })
  await page.addScriptTag({ content: bundle })
  return page
}

test('새 게시물 카드를 누르면 그 크리에이터 스페이스로 postId와 함께 이동한다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.renderFeed())
    await page.getByText('새 게시물 3', { exact: true }).click()
    const arrived = await page.getByTestId('arrived').textContent()
    assert.deepEqual(JSON.parse(arrived), { path: '/dock', state: { tab: 'posts', openPostId: 3 } })
  } finally { await page.close() }
})

test('initialPostId가 있으면 목록을 누르지 않아도 그 게시글 상세를 한 번 열고 알린다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.renderPosts())
    await page.getByText('게시글 2', { exact: true }).first().waitFor()
    assert.ok((await page.evaluate(() => window.requested)).includes('/api/creators/13/posts/2'))
    assert.equal(await page.evaluate(() => window.openedCalls), 1)
  } finally { await page.close() }
})
