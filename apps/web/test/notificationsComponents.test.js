import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser
const item = (id, readAt = null) => ({ notificationId: id, type: 'EVENT_OPENED', title: `알림 ${id}`, body: '', createdAt: '2026-10-15T00:00:00Z', readAt, event: null, drawing: null })
const list = (items, page = 0, hasNext = false) => ({ items, page, hasNext })

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/notificationsBrowser.jsx', import.meta.url)), name: 'NotificationsTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.NOTIFICATIONS_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** 외부 요청을 막고 GET/PATCH의 응답 순서를 테스트에서 직접 결정한다. */
async function screen() {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/notifications-test')
  await page.evaluate(() => {
    window.toasts = []
    window.requests = []
    window.fetch = (url, options) => new Promise((resolve, reject) => {
      window.requests.push({ url: String(url), method: options.method, resolve, reject })
    })
    window.respond = (index, data, status = 200) => window.requests[index].resolve(new Response(
      JSON.stringify({ code: status === 200 ? 'SUCCESS' : 'ERROR', data, message: '조회 실패' }), { status },
    ))
  })
  await page.addScriptTag({ content: bundle })
  return { page, errors }
}

async function requestCount(page, count) {
  await page.waitForFunction((expected) => window.requests.length >= expected, count)
}

test('진행 중인 GET보다 개별 읽음이 먼저 끝나도 카드와 헤더 배지가 읽음 상태를 유지한다', async () => {
  const { page, errors } = await screen()
  try {
    await requestCount(page, 1)
    await page.evaluate((data) => window.respond(0, data), list([item(1)]))
    await page.getByLabel('읽지 않은 알림 1개').waitFor()
    await page.getByRole('button', { name: '알림 열기' }).click()
    await requestCount(page, 2)
    await page.getByRole('button', { name: /알림 1/ }).click()
    await requestCount(page, 3)
    await page.evaluate(() => window.respond(2, { readAt: '2026-10-15T01:00:00Z' }))
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="읽지 않음"]').length === 0)
    await page.evaluate((data) => window.respond(1, data), list([{ ...item(1), title: '오래된 알림 1' }]))
    await page.getByText('오래된 알림 1').waitFor()
    assert.equal(await page.getByText('읽지 않은 알림 1개').count(), 0)
    await page.getByRole('link', { name: '홈' }).click()
    await page.getByRole('button', { name: '알림 열기' }).waitFor()
    assert.equal(await page.getByLabel('읽지 않은 알림 1개').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('개별 읽음 실패 시 카드와 배지를 복구하고 알림 화면에 머문다', async () => {
  const { page, errors } = await screen()
  try {
    await requestCount(page, 1)
    await page.evaluate((data) => window.respond(0, data), list([item(1)]))
    await page.getByRole('button', { name: '알림 열기' }).click()
    await requestCount(page, 2)
    await page.evaluate((data) => window.respond(1, data), list([item(1)]))
    await page.getByRole('button', { name: /알림 1/ }).click()
    await requestCount(page, 3)
    await page.evaluate(() => window.respond(2, null, 500))
    await requestCount(page, 4)
    await page.evaluate((data) => window.respond(3, data), list([item(1)]))
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="읽지 않음"]').length === 1)
    assert.equal(await page.getByRole('button', { name: /알림 1/ }).count(), 1)
    await page.getByRole('link', { name: '홈' }).click()
    await page.getByLabel('읽지 않은 알림 1개').waitFor({ state: 'attached' })
    assert.equal(await page.getByLabel('읽지 않은 알림 1개').count(), 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('100번째 다음에는 다음 100건을 조회해 101번째 알림을 표시한다', async () => {
  const { page, errors } = await screen()
  try {
    await requestCount(page, 1)
    const first = Array.from({ length: 100 }, (_, index) => item(index + 1))
    await page.evaluate((data) => window.respond(0, data), list(first, 0, true))
    await page.getByRole('button', { name: '알림 열기' }).click()
    await requestCount(page, 2)
    await page.evaluate((data) => window.respond(1, data), list(first, 0, true))
    for (let index = 0; index < 5; index += 1) await page.getByRole('button', { name: '다음 페이지' }).click()
    await requestCount(page, 3)
    assert.match(await page.evaluate(() => window.requests[2].url), /page=1&size=100/)
    await page.evaluate((data) => window.respond(2, data), list([item(101)], 1, false))
    await page.getByText('알림 101').waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('전체 읽음은 한 번 호출하고 후속 조회 실패를 따로 안내한다', async () => {
  const { page, errors } = await screen()
  try {
    await requestCount(page, 1)
    await page.evaluate((data) => window.respond(0, data), list([item(1)]))
    await page.getByRole('button', { name: '알림 열기' }).click()
    await requestCount(page, 2)
    await page.evaluate((data) => window.respond(1, data), list([item(1)]))
    await page.getByRole('button', { name: '모두 읽음' }).click()
    await requestCount(page, 3)
    assert.equal(await page.evaluate(() => window.requests.filter((request) => request.method === 'PATCH').length), 1)
    await page.evaluate(() => window.respond(2, { readCount: 1 }))
    await requestCount(page, 4)
    await page.evaluate(() => window.respond(3, null, 500))
    await page.getByRole('status').getByText('최신 목록을 확인하지 못했습니다.', { exact: false }).waitFor()
    assert.equal(await page.evaluate(() => window.toasts.at(-1)), '1개의 알림을 읽음 처리했어요. 최신 목록은 다시 확인해 주세요.')
    assert.equal(await page.getByLabel('읽지 않음').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
