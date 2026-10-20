import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 신고 버튼: 남의 댓글에만 보이고, 본인 댓글과 필터 차단·관리자 숨김으로 가려진 댓글(filtered)에는 보이지 않는다.
// 삭제 확인 시트 테스트와 같은 화면(PostComments)을 쓴다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/postCommentsDeleteBrowser.jsx', import.meta.url)), name: 'ReportButton', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const at = '2026-10-20T02:00:00Z'
const comments = [
  { commentId: 1, authorMemberId: 7, authorName: '내 이름', content: '내가 쓴 댓글', filtered: false, createdAt: at, updatedAt: at },
  { commentId: 2, authorMemberId: 8, authorName: '다른 회원', content: '보이는 남의 댓글', filtered: false, createdAt: at, updatedAt: at },
  { commentId: 3, authorMemberId: 9, authorName: null, content: null, filtered: true, revealable: false, createdAt: at, updatedAt: at },
  { commentId: 4, authorMemberId: 10, authorName: null, content: null, filtered: true, revealable: true, createdAt: at, updatedAt: at },
]

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/report-button')
  await page.addStyleTag({ content: css })
  await page.evaluate((list) => {
    window.fetch = async (url) => {
      const path = new URL(url).pathname
      if (path.endsWith('/comments')) return new Response(JSON.stringify({ code: 'SUCCESS', data: { items: list, page: 0, hasNext: false } }), { status: 200 })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, comments)
  await page.addScriptTag({ content: bundle })
  await page.evaluate(() => window.renderComments({}))
  await page.getByText('보이는 남의 댓글').waitFor()
  return page
}
const reportButtons = (page) => page.getByRole('button', { name: '신고', exact: true })

test('남의 댓글에만 신고 버튼이 보이고 본인·가려진 댓글에는 보이지 않는다', async () => {
  const page = await screen()
  try {
    assert.equal(await reportButtons(page).count(), 1)
    assert.equal(await page.locator('li', { hasText: '보이는 남의 댓글' }).getByRole('button', { name: '신고', exact: true }).count(), 1)
    assert.equal(await page.locator('li', { hasText: '내가 쓴 댓글' }).getByRole('button', { name: '신고', exact: true }).count(), 0)
    assert.equal(await page.getByText('볼 수 없는 댓글이에요.').count(), 1)
    assert.equal(await page.getByText('필터링된 댓글이에요.').count(), 1)
  } finally { await page.close() }
})
