import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 댓글 삭제 확인 시트(ConfirmSheet): 취소, 중복 제출 방지, 관리자 삭제 문구, 이미 삭제된 댓글(404) 처리.
// 시트 닫기 복사본이 텍스트 검증에 섞이지 않도록 모션을 줄인 브라우저로 실행한다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/postCommentsDeleteBrowser.jsx', import.meta.url)), name: 'Delete276', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const comments = [
  { commentId: 1, authorMemberId: 7, authorName: '내 이름', content: '내가 쓴 댓글', createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' },
  { commentId: 2, authorMemberId: 8, authorName: '다른 회원', content: '남이 쓴 댓글', createdAt: '2026-10-20T02:00:00Z', updatedAt: '2026-10-20T02:00:00Z' },
]

/** 댓글 목록은 comments에서 삭제된 것을 뺀 값으로 응답하고, DELETE는 respondDelete가 정한다. */
async function screen(options) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/delete276')
  await page.addStyleTag({ content: css })
  await page.evaluate((list) => {
    window.deleteCalls = []
    window.removed = new Set()
    window.respondDelete = () => new Response(null, { status: 204 })
    window.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname
      if ((init.method ?? 'GET') === 'DELETE') {
        window.deleteCalls.push(path)
        const response = await window.respondDelete(path)
        if (response.status === 204 || response.status === 404) window.removed.add(Number(path.split('/').at(-1)))
        return response
      }
      if (path.endsWith('/comments')) {
        const items = list.filter((comment) => !window.removed.has(comment.commentId))
        return new Response(JSON.stringify({ code: 'SUCCESS', data: { items, page: 0, hasNext: false } }), { status: 200 })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, comments)
  await page.addScriptTag({ content: bundle })
  await page.evaluate((opts) => window.renderComments(opts), options)
  await page.getByText('남이 쓴 댓글').waitFor()
  return page
}
const deleteButtonOf = (page, text) => page.locator('li', { hasText: text }).getByRole('button', { name: '삭제', exact: true })

test('본인 댓글은 확인 시트가 열리고 취소하면 아무것도 삭제하지 않는다', async () => {
  const page = await screen({})
  try {
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    const sheet = page.getByRole('dialog', { name: '댓글을 삭제할까요?' })
    await sheet.waitFor()
    await sheet.getByText('삭제하면 되돌릴 수 없어요.').waitFor()
    await sheet.getByRole('button', { name: '취소' }).click()
    await sheet.waitFor({ state: 'detached' })
    // 바깥(배경)을 눌러도 닫히기만 한다.
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    await page.getByRole('dialog').waitFor()
    await page.mouse.click(10, 10)
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), [])
    assert.equal(await page.getByText('내가 쓴 댓글').count(), 1)
  } finally { await page.close() }
})

test('삭제 요청 중에는 시트가 닫히지 않고 두 번 눌러도 요청은 한 번만 간다', async () => {
  const page = await screen({})
  try {
    await page.evaluate(() => { window.respondDelete = () => new Promise((resolve) => { window.finishDelete = () => resolve(new Response(null, { status: 204 })) }) })
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    const sheet = page.getByRole('dialog', { name: '댓글을 삭제할까요?' })
    await sheet.getByRole('button', { name: '삭제', exact: true }).click()
    const pending = sheet.getByRole('button', { name: '처리하는 중...' })
    await pending.waitFor()
    assert.equal(await pending.isDisabled(), true)
    assert.equal(await sheet.getByRole('button', { name: '취소' }).isDisabled(), true)
    await page.keyboard.press('Escape')
    await page.mouse.click(10, 10)
    assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await page.getByRole('button', { name: '닫기', exact: true }).count(), 0)
    await page.evaluate(() => window.finishDelete())
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), ['/api/creators/13/posts/5/comments/1'])
    assert.deepEqual(await page.evaluate(() => window.countChanges), [-1])
    assert.equal(await page.getByText('내가 쓴 댓글').count(), 0)
  } finally { await page.close() }
})

test('관리자가 남의 댓글을 지우면 관리자 문구와 관리자 API를 쓴다', async () => {
  const page = await screen({ isAdmin: true })
  try {
    await deleteButtonOf(page, '남이 쓴 댓글').click()
    const sheet = page.getByRole('dialog', { name: '관리자 권한으로 댓글을 삭제할까요?' })
    await sheet.waitFor()
    await sheet.getByText('되돌릴 수 없고, 작성자에게 경고나 알림은 가지 않아요.').waitFor()
    await sheet.getByRole('button', { name: '삭제', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(() => window.deleteCalls), ['/api/admin/comments/2'])
    // 관리자라도 본인 댓글은 일반 문구다.
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    await page.getByRole('dialog', { name: '댓글을 삭제할까요?' }).waitFor()
  } finally { await page.close() }
})

test('이미 삭제된 댓글(404)이면 행만 숨기고 댓글 수는 줄이지 않는다', async () => {
  const page = await screen({})
  try {
    await page.evaluate(() => { window.respondDelete = () => new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', message: '댓글을 찾을 수 없습니다.' }), { status: 404 }) })
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.getByText('내가 쓴 댓글').count(), 0)
    assert.deepEqual(await page.evaluate(() => window.countChanges), [])
    assert.equal((await page.evaluate(() => window.toasts)).length, 1)
  } finally { await page.close() }
})

test('삭제가 실패하면 시트가 닫히고 댓글은 그대로 남는다', async () => {
  const page = await screen({})
  try {
    await page.evaluate(() => { window.respondDelete = () => new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: '오류' }), { status: 500 }) })
    await deleteButtonOf(page, '내가 쓴 댓글').click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.getByText('내가 쓴 댓글').count(), 1)
    assert.deepEqual(await page.evaluate(() => window.countChanges), [])
    assert.equal((await page.evaluate(() => window.toasts)).length, 1)
  } finally { await page.close() }
})
