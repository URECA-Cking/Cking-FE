import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시물 이미지는 불러오자마자 모두 미리 디코딩한다. iOS(WebKit)는 화면 밖 칸의 이미지 디코딩을 미뤄, 스와이프로 넘어온 칸이 비어 보였다(#386).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'PostImagesDecode', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const images = [1, 2, 3, 4].map((n) => ({ imageKey: `post-images/${n}.png`, url: `http://localhost/img/${n}.png` }))
const post = { postId: 5, creatorId: 13, content: '이미지 게시글', visibility: 'PUBLIC', locked: false, imageCount: 4, images, likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

test('상세를 열면 모든 이미지를 한 번씩 미리 디코딩한다(화면 밖 칸 포함)', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await page.addInitScript(() => {
      window.decoded = []
      const decode = HTMLImageElement.prototype.decode
      HTMLImageElement.prototype.decode = function spy() { window.decoded.push(this.getAttribute('src')); return decode.call(this) }
    })
    await page.route('**/*', (route) => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
    await page.route('**/img/*.png', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
    await page.goto('http://localhost/decode-test')
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
    await page.getByAltText('크리에이터의 게시글 이미지 4').waitFor({ state: 'attached' })
    await page.waitForFunction(() => window.decoded.length >= 4)
    const decoded = await page.evaluate(() => window.decoded)
    assert.deepEqual([...new Set(decoded)].sort(), images.map((image) => image.url).sort())
    // 한 장당 한 번만(첫 칸의 비율 계산 등 다른 처리와 겹쳐 중복 호출하지 않는다).
    assert.equal(decoded.length, 4)
  } finally { await page.close() }
})
