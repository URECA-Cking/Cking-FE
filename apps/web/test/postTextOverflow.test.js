import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 띄어쓰기 없는 긴 글자(웃음 반복, 긴 링크)도 게시글 카드·상세·홈 새 게시물 카드의 폭 안에서 줄을 바꾼다.
let bundle, css, browser
const LONG = 'ㅋ'.repeat(200) + ' https://example.com/' + 'a'.repeat(150)

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/postTextOverflowBrowser.jsx', import.meta.url)), name: 'PostTextOverflow', formats: ['iife'] } },
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
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/post-text-overflow')
  await page.addStyleTag({ content: css })
  await page.evaluate((content) => {
    const item = { postId: 5, content, visibility: 'PUBLIC', locked: false, imageCount: 0, images: [], likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }
    window.fetch = async (url) => {
      const path = new URL(url, location.href).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creators/13/posts') return reply({ items: [item], page: 0, hasNext: false, totalPages: 1 })
      if (path === '/api/creators/13/posts/5') return reply(item)
      if (path.endsWith('/comments')) return reply({ items: [], page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, LONG)
  await page.addScriptTag({ content: bundle })
  return page
}

/** 긴 글자가 든 요소의 내용 폭이 상자 폭을 넘지 않는지(가로로 잘리거나 밖으로 나가지 않는지) 본다. */
const overflowing = (locator) => locator.evaluate((element) => element.scrollWidth - element.clientWidth)

test('홈 새 게시물 카드 제목은 긴 글자도 카드 폭 안에서 줄을 바꾼다', async () => {
  const page = await screen()
  try {
    await page.evaluate((content) => window.renderFeed(content), LONG)
    const title = page.getByText(/^ㅋㅋㅋ/).first()
    await title.waitFor()
    assert.ok(await overflowing(title) <= 1)
  } finally { await page.close() }
})

test('스페이스 게시글 칸과 상세 본문은 긴 글자도 폭 안에서 줄을 바꾼다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.renderPosts(null))
    const tile = page.locator('button[aria-label^="게시글"] span.line-clamp-6')
    await tile.waitFor()
    assert.ok(await overflowing(tile) <= 1)
    await page.evaluate(() => window.renderPosts(5))
    const caption = page.getByRole('dialog', { name: '게시글 상세' }).locator('p', { hasText: 'ㅋㅋㅋ' })
    await caption.waitFor()
    assert.ok(await overflowing(caption) <= 1)
  } finally { await page.close() }
})
