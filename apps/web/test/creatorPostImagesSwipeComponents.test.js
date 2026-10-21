import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시물 이미지 캐러셀: 빠르게 튕겨도 이미지를 건너뛰지 않고 다음 한 장에서 멈춘다(snap-always).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'PostImagesSwipe', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const images = [1, 2, 3, 4, 5].map((n) => ({ imageKey: `post-images/${n}.png`, url: `http://localhost/img/${n}.png` }))
const post = { postId: 5, creatorId: 13, content: '이미지 게시글', visibility: 'PUBLIC', locked: false, imageCount: 5, images, likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

async function screen() {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }) : route.abort())
  await page.route('**/img/*.png', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
  await page.goto('http://localhost/posts-swipe')
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
  await page.getByRole('button', { name: /^게시글 이미지 게시글/ }).click()
  await page.getByAltText('크리에이터의 게시글 이미지 1').waitFor()
  return { page, context }
}

/** 손가락을 `ms` 동안 `distance`만큼 밀어 튕긴다. 이벤트 시각을 직접 줘서 속도가 일정하게 한다. */
async function flick(page, context, distance, ms) {
  const box = await page.getByAltText('크리에이터의 게시글 이미지 1').boundingBox()
  const cdp = await context.newCDPSession(page)
  const x = box.x + box.width * 0.8
  const y = box.y + box.height / 2
  const start = Date.now() / 1000
  const steps = 8
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }], timestamp: start })
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (distance * step) / steps, y }], timestamp: start + (ms / 1000) * (step / steps) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: start + ms / 1000 })
  await page.waitForTimeout(1500)
}
const position = (page) => page.evaluate(() => {
  const scroller = document.querySelector('.snap-x')
  return scroller.scrollLeft / scroller.clientWidth
})

// 빠르게 튕겼을 때 몇 장을 건너뛰는지는 기기·엔진의 관성 계산에 달려 있어(같은 동작도 환경마다 한 장 차이가 난다) 결과 위치를 정확한 값으로 단정하지 않는다.
// 건너뛰지 않게 하는 장치(scroll-snap-stop: always)가 모든 이미지 칸에 있는지를 직접 확인하고, 움직임은 한 장을 넘지 않는지만 본다.
test('모든 이미지 칸은 scroll-snap-stop: always라 빠르게 넘겨도 지나치지 않는다', async () => {
  const { page, context } = await screen()
  try {
    const stops = await page.evaluate(() => [...document.querySelectorAll('.snap-x > div')].map((slide) => getComputedStyle(slide).scrollSnapStop))
    assert.equal(stops.length, 5)
    assert.deepEqual([...new Set(stops)], ['always'])
  } finally { await context.close() }
})

for (const [distance, ms] of [[120, 60], [60, 60]]) {
  test(`튕기는 동작(${distance}px/${ms}ms)이 한 장을 넘어서까지 건너뛰지 않는다`, async () => {
    const { page, context } = await screen()
    try {
      await flick(page, context, distance, ms)
      assert.ok(await position(page) <= 1.01)
    } finally { await context.close() }
  })
}
