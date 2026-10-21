import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시물 이미지 캐러셀: 칸 높이는 컨테이너에 고정되고(이미지는 칸 높이에 영향을 주지 않는다) 세로로는 스크롤되지 않는다(#391).
// iOS 사파리에서 이미지가 위아래로도 움직이는 현상을 이 환경(크롬)에서는 재현하지 못해, 높이가 이미지에 좌우되지 않는 구조와 세로 스크롤 차단을 직접 확인한다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'PostImagesHeight', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

// 비율이 서로 다른 이미지: 가로(첫 칸 기준), 조금 더 정사각형에 가까움, 거의 정사각형, 세로.
const SIZES = [[400, 225], [400, 260], [400, 346], [200, 350]]
const images = SIZES.map((_, index) => ({ imageKey: `post-images/${index + 1}.png`, url: `http://localhost/img/${index + 1}.png` }))
const post = { postId: 5, creatorId: 13, content: '이미지 게시글', visibility: 'PUBLIC', locked: false, imageCount: 4, images, likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const pngs = await page.evaluate((sizes) => sizes.map(([w, h]) => { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const context = canvas.getContext('2d'); context.fillStyle = '#336699'; context.fillRect(0, 0, w, h); return canvas.toDataURL('image/png').split(',')[1] }), SIZES)
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.route('**/img/*.png', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(pngs[Number(route.request().url().match(/(\d+)\.png/)[1]) - 1], 'base64') }))
  await page.goto('http://localhost/carousel-height')
  await page.addStyleTag({ content: css })
  await page.evaluate((item) => {
    window.fetch = async (url) => {
      const path = new URL(String(url), location.href).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creators/13/posts') return reply({ items: [item], page: 0, hasNext: false, totalPages: 1 })
      if (path === '/api/creators/13/posts/5') return reply(item)
      if (path.endsWith('/comments')) return reply({ items: [], page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, post)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: /^게시글 이미지 게시글/ }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('.snap-x img')].length === 4 && [...document.querySelectorAll('.snap-x img')].every((image) => image.complete && image.naturalWidth > 0))
  return page
}
const measure = (page) => page.evaluate(() => {
  const scroller = document.querySelector('.snap-x')
  return {
    overflowY: getComputedStyle(scroller).overflowY,
    client: scroller.clientHeight,
    scroll: scroller.scrollHeight,
    slides: [...scroller.children].filter((child) => child.tagName === 'DIV').map((slide) => Math.round(slide.getBoundingClientRect().height)),
    imagePositions: [...scroller.querySelectorAll('img')].map((image) => getComputedStyle(image).position),
  }
})

test('모든 칸의 높이가 컨테이너와 같고 세로로 스크롤되지 않는다', async () => {
  const page = await screen()
  try {
    const result = await measure(page)
    assert.equal(result.overflowY, 'hidden')
    assert.ok(result.scroll <= result.client + 1, `세로로 넘치면 안 된다: ${result.scroll} > ${result.client}`)
    assert.deepEqual([...new Set(result.slides)], [result.client])
    // 이미지가 칸 높이를 정하지 않도록 칸을 absolute로 채운다.
    assert.deepEqual([...new Set(result.imagePositions)], ['absolute'])
  } finally { await page.close() }
})
