import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시물 이미지 한 장의 로드가 일시적으로 실패해도(주소는 그대로) 다시 불러오고, 계속 실패할 때만 "다시 불러오기" 안내로 바꾼다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'PostImagesRetry', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const images = [1, 2, 3].map((n) => ({ imageKey: `post-images/${n}.png`, url: `http://localhost/img/${n}.png` }))
const post = { postId: 5, creatorId: 13, content: '이미지 게시글', visibility: 'PUBLIC', locked: false, imageCount: 3, images, likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

/** 세 번째 이미지는 처음 `failures`번 요청을 실패시킨다. 게시물을 다시 조회해도 주소는 같다. */
async function screen(failures) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  let thirdRequests = 0
  await page.route('**/img/*.png', (route) => {
    if (!route.request().url().endsWith('/3.png')) return route.fulfill({ contentType: 'image/png', body: PNG })
    thirdRequests += 1
    return thirdRequests <= failures ? route.abort() : route.fulfill({ contentType: 'image/png', body: PNG })
  })
  await page.goto('http://localhost/posts-images')
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
  return { page, thirdRequests: () => thirdRequests }
}
const third = (page) => page.getByAltText('크리에이터의 게시글 이미지 3')

test('세 번째 이미지가 한 번 실패해도 같은 주소로 다시 불러와 보여 준다', async () => {
  const { page, thirdRequests } = await screen(1)
  try {
    await third(page).waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const image = document.querySelector('img[alt="크리에이터의 게시글 이미지 3"]')
      return image?.complete && image.naturalWidth > 0
    })
    assert.equal(await page.getByRole('button', { name: '이미지 다시 불러오기' }).count(), 0)
    assert.equal(thirdRequests(), 2)
  } finally { await page.close() }
})

test('계속 실패하면 한 번만 다시 시도하고 "이미지 다시 불러오기"로 바꾼다', async () => {
  const { page, thirdRequests } = await screen(99)
  try {
    await page.getByRole('button', { name: '이미지 다시 불러오기' }).waitFor()
    assert.equal(thirdRequests(), 2)
  } finally { await page.close() }
})
