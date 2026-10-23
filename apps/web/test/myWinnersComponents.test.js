import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

const winner = (status = 'SELECTED') => ({
  winnerId: 1,
  eventId: 16,
  drawingId: 20,
  drawNo: 0,
  drawType: 'INITIAL',
  rankInDrawing: 1,
  appliedTicketCount: 2,
  winnerCreatedAt: '2026-10-15T01:00:00Z',
  winnerManagementStatus: status,
})

const events = { items: [{ eventId: 16, title: '가을 커피 기프트 이벤트' }] }

test.before(async () => {
  const output = await build({
    configFile: false,
    plugins: [react()],
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL('./fixtures/myWinnersBrowser.jsx', import.meta.url)),
        name: 'MyWinnersTest',
        formats: ['iife'],
      },
    },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.MY_WINNERS_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})

test.after(async () => { await browser?.close() })

async function screen() {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/my-winners-test')
  await page.evaluate(() => {
    window.toasts = []
    window.requests = []
    window.fetch = (url, options = {}) => new Promise((resolve, reject) => {
      window.requests.push({
        url: String(url),
        method: options.method ?? 'GET',
        resolve,
        reject,
        completed: false,
      })
    })
    window.reply = (path, data, status = 200, message = '요청에 실패했어요.') => {
      const request = window.requests.find((item) => !item.completed && new URL(item.url, window.location.origin).pathname === path)
      if (!request) throw new Error(`응답할 요청이 없습니다: ${path}`)
      request.completed = true
      request.resolve(new Response(JSON.stringify({ code: status >= 200 && status < 300 ? 'SUCCESS' : 'ERROR', data, message }), {
        status,
        headers: { 'content-type': 'application/json' },
      }))
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.evaluate(() => window.renderMyWinners())
  return { page, errors }
}

async function waitForRequest(page, path, method = 'GET') {
  await page.waitForFunction(({ path: expectedPath, method: expectedMethod }) => window.requests.some((request) => (
    !request.completed
    && request.method === expectedMethod
    && new URL(request.url, window.location.origin).pathname === expectedPath
  )), { path, method })
}

async function waitForRequestCount(page, count) {
  await page.waitForFunction((expected) => window.requests.length >= expected, count)
}

async function loadWinners(page, data = [winner()]) {
  await waitForRequest(page, '/api/me/winners')
  await page.evaluate((result) => window.reply('/api/me/winners', result), data)
  await page.getByText('이벤트 정보를 불러오지 못했어요').first().waitFor()
}

async function loadEventNames(page) {
  await waitForRequest(page, '/api/events')
  await page.evaluate((result) => window.reply('/api/events', result), events)
  await page.getByRole('article').getByText('가을 커피 기프트 이벤트').waitFor()
}

test('당첨 목록은 이벤트명 보강 조회를 기다리지 않고 표시하고 상세·진행 내역을 연다', { timeout: 10_000 }, async () => {
  const { page, errors } = await screen()
  try {
    await loadWinners(page)
    await page.getByRole('button', { name: '당첨 상세 보기' }).click()
    await page.getByText('응모권 사용').waitFor()
    await page.getByRole('button', { name: /진행 내역/ }).click()
    await waitForRequest(page, '/api/winners/1/history')
    await page.evaluate(() => window.reply('/api/winners/1/history', [{
      historyId: 1,
      afterStatus: 'SELECTED',
      changedAt: '2026-10-15T01:00:00Z',
      reason: '최초 당첨',
    }]))
    await page.getByText('최초 당첨').waitFor()
    await loadEventNames(page)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('당첨 포기 확인에서 돌아가면 포기 API를 호출하지 않는다', { timeout: 10_000 }, async () => {
  const { page, errors } = await screen()
  try {
    await loadWinners(page)
    await loadEventNames(page)
    await page.getByRole('button', { name: '당첨 상세 보기' }).click()
    await page.getByRole('button', { name: '당첨 포기', exact: true }).click()
    await page.getByRole('button', { name: '돌아가기' }).click()
    await page.getByRole('button', { name: '당첨 포기', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.requests.filter((request) => (
      request.method === 'POST' && new URL(request.url, window.location.origin).pathname === '/api/me/winners/1/decline'
    )).length), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('당첨 포기 성공 후 목록과 상태 필터 건수를 서버 응답으로 갱신한다', { timeout: 10_000 }, async () => {
  const { page, errors } = await screen()
  try {
    await loadWinners(page)
    await loadEventNames(page)
    await page.getByRole('button', { name: '당첨 상세 보기' }).click()
    await page.getByRole('button', { name: '당첨 포기', exact: true }).click()
    await page.getByRole('button', { name: '포기하기' }).click()
    await waitForRequestCount(page, 3)
    assert.match(await page.evaluate(() => window.requests.at(-1).url), /\/api\/me\/winners\/1\/decline$/)
    await page.evaluate(() => window.reply('/api/me/winners/1/decline', null))
    await waitForRequestCount(page, 4)
    await page.evaluate((result) => window.reply('/api/me/winners', result), [winner('DECLINED')])
    await page.getByRole('button', { name: /당첨 포기1/ }).waitFor()
    assert.match(await page.getByRole('article').innerText(), /당첨 포기/)
    assert.equal(await page.evaluate(() => window.toasts.at(-1)), '당첨 포기가 완료됐어요.')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('당첨 포기 실패 시 오류를 안내하고 상세 확인 상태를 유지한다', { timeout: 10_000 }, async () => {
  const { page, errors } = await screen()
  try {
    await loadWinners(page)
    await loadEventNames(page)
    await page.getByRole('button', { name: '당첨 상세 보기' }).click()
    await page.getByRole('button', { name: '당첨 포기', exact: true }).click()
    await page.getByRole('button', { name: '포기하기' }).click()
    await waitForRequestCount(page, 3)
    assert.match(await page.evaluate(() => window.requests.at(-1).url), /\/api\/me\/winners\/1\/decline$/)
    await page.evaluate(() => window.reply('/api/me/winners/1/decline', null, 500, '당첨 포기를 처리하지 못했어요.'))
    await page.getByText('당첨을 포기할까요?').waitFor()
    await page.waitForFunction(() => window.toasts.at(-1) === '당첨 포기를 처리하지 못했어요.')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
