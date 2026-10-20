import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시글 삭제는 window.confirm이 아니라 확인 시트(ConfirmSheet)로 확인한다: 취소하면 요청이 없고, 처리 중에는 닫히지 않으며, 확인하면 삭제한다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorPostsDeleteBrowser.jsx', import.meta.url)), name: 'PostsDelete', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const post = { postId: 5, content: '삭제할 게시글', visibility: 'PUBLIC', locked: false, imageCount: 0, images: [], likeCount: 0, liked: false, commentCount: 0, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 시트를 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/posts-delete')
  await page.addStyleTag({ content: css })
  await page.evaluate((item) => {
    window.deleteCalls = []
    window.respondDelete = () => new Response(null, { status: 204 })
    window.removed = false
    window.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if ((init.method ?? 'GET') === 'DELETE' && path === '/api/creator/posts/5') {
        window.deleteCalls.push(path)
        const response = await window.respondDelete()
        if (response.status === 204) window.removed = true
        return response
      }
      if (path === '/api/creators/13/posts') return reply({ items: window.removed ? [] : [item], page: 0, hasNext: false, totalPages: 1 })
      if (path === '/api/creators/13/posts/5') return reply(item)
      if (path.endsWith('/comments')) return reply({ items: [], page: 0, hasNext: false })
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, post)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: /^게시글 삭제할 게시글/ }).click()
  await page.getByRole('button', { name: '게시글 메뉴' }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  return page
}

test('게시글 삭제는 확인 시트가 열리고 취소하면 요청이 가지 않는다', async () => {
  const page = await screen()
  try {
    const sheet = page.getByRole('dialog', { name: '게시글을 삭제할까요?' })
    await sheet.waitFor()
    await sheet.getByText('삭제하면 이미지와 댓글도 함께 사라지고 되돌릴 수 없어요.').waitFor()
    await sheet.getByRole('button', { name: '취소' }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), [])
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})

test('삭제 요청 중에는 시트가 닫히지 않고, 확인하면 삭제하고 상세를 닫는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.respondDelete = () => new Promise((resolve) => { window.finishDelete = () => resolve(new Response(null, { status: 204 })) }) })
    const sheet = page.getByRole('dialog', { name: '게시글을 삭제할까요?' })
    await sheet.getByRole('button', { name: '삭제', exact: true }).click()
    const pending = sheet.getByRole('button', { name: '처리하는 중...' })
    await pending.waitFor()
    assert.equal(await pending.isDisabled(), true)
    await page.keyboard.press('Escape')
    assert.equal(await sheet.count(), 1)
    await page.evaluate(() => window.finishDelete())
    await sheet.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), ['/api/creator/posts/5'])
    assert.deepEqual(await page.evaluate(() => window.toasts), ['게시글을 삭제했어요.'])
    assert.equal(await page.getByRole('button', { name: /^게시글 삭제할 게시글/ }).count(), 0)
    assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
  } finally { await page.close() }
})

test('삭제가 실패하면 시트가 닫히고 게시글은 그대로 남는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.respondDelete = () => new Response(JSON.stringify({ code: 'SYSTEM_ERROR', message: 'fail' }), { status: 500 }) })
    const sheet = page.getByRole('dialog', { name: '게시글을 삭제할까요?' })
    await sheet.getByRole('button', { name: '삭제', exact: true }).click()
    await sheet.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), ['/api/creator/posts/5'])
    assert.equal((await page.evaluate(() => window.toasts)).length, 1)
    assert.equal(await page.getByRole('button', { name: '게시글 메뉴' }).count(), 1)
  } finally { await page.close() }
})
