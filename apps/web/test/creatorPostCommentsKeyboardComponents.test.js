import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 안드로이드 크롬은 키보드가 올라와도 레이아웃 뷰포트는 그대로 두고 보이는 영역(visualViewport)만 줄인다.
// 그때도 게시물 상세의 댓글 입력창이 키보드 위로 올라와 보여야 한다. 실제 키보드 대신 가짜 visualViewport로 흉내 낸다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'CommentsKeyboard', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const post = { postId: 5, creatorId: 13, content: '게시글', visibility: 'PUBLIC', locked: false, imageCount: 0, images: [], likeCount: 0, liked: false, commentCount: 12, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }
const comments = Array.from({ length: 12 }, (_, index) => ({ commentId: index + 1, authorMemberId: 8, authorName: '다른 회원', content: `댓글 ${index + 1}`, createdAt: '2026-10-20T02:00:00Z', updatedAt: '2026-10-20T02:00:00Z' }))

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, { height: window.innerHeight, offsetTop: 0 })
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
    window.openKeyboard = (px) => { viewport.height = window.innerHeight - px; viewport.dispatchEvent(new Event('resize')) }
  })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/comments-keyboard')
  await page.addStyleTag({ content: css })
  await page.evaluate(([item, list]) => {
    window.fetch = async (url) => {
      const path = new URL(url).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creators/13/posts') return reply({ items: [item], page: 0, hasNext: false, totalPages: 1 })
      if (path === '/api/creators/13/posts/5') return reply(item)
      if (path.endsWith('/comments')) return reply({ items: list, page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, [post, comments])
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: /^게시글 게시글/ }).click()
  await page.getByRole('button', { name: '댓글 열기', exact: true }).click()
  await page.getByLabel('댓글 입력').waitFor()
  return page
}

test('키보드가 보이는 영역만 줄여도 댓글 입력창이 키보드 위에 보인다', async () => {
  const page = await screen()
  try {
    const input = page.getByLabel('댓글 입력')
    await input.scrollIntoViewIfNeeded()
    await input.focus()
    await page.evaluate(() => window.openKeyboard(320))
    await page.waitForFunction(() => {
      const box = document.querySelector('textarea[aria-label="댓글 입력"]').getBoundingClientRect()
      return box.bottom <= window.innerHeight - 320 + 1
    })
    const keyboardTop = await page.evaluate(() => window.innerHeight - 320)
    assert.ok((await input.boundingBox()).y + (await input.boundingBox()).height <= keyboardTop + 1)
    // 키보드를 내리면 오버레이가 화면 끝까지 돌아온다.
    await page.evaluate(() => window.openKeyboard(0))
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[role="dialog"]')).bottom === '0px')
  } finally { await page.close() }
})
