import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let browser, bundle
const pageErrors = []

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent', define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://event.test'), 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/eventPrizeKeysBrowser.jsx', import.meta.url)), name: 'EventApprovalTest', formats: ['iife'] } } })
  bundle = (Array.isArray(output) ? output[0] : output).output.find(asset => asset.type === 'chunk').code
  const paths = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {} })
})

test.after(async () => {
  await browser?.close()
  assert.deepEqual(pageErrors, [])
})

/** Creator 이벤트 생성·수정 API를 흉내 내고 해당 폼을 브라우저에 연다. */
async function openForm(edit = false) {
  const page = await browser.newPage()
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    : route.abort())
  await page.goto('http://localhost/event-form')
  await page.evaluate(editMode => {
    window.eventPath = editMode ? '/creator/events/28/edit' : '/creator/events/new'
    window.calls = []
    window.toasts = []
    window.failApproval = false
    window.deferApproval = false
    window.resolveApproval = null
    window.approvalSettled = false
    window.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname
      const method = options.method ?? 'GET'
      window.calls.push({ path, method, body: options.body ? JSON.parse(options.body) : undefined })
      const response = (data, status = 200, code = 'SUCCESS', message) => new Response(JSON.stringify({ code, data, message }), { status })
      if (path === '/api/creator/space') return response(null)
      if (path === '/api/creator/events' && method === 'GET') return response({ items: [{ eventId: 28, title: '기존 이벤트', description: '', drawMethod: 'WEIGHTED', winnerCount: 1, startAt: '2030-01-01T01:00:00Z', endAt: '2030-02-01T01:00:00Z', prizes: [{ prizeKey: 'FIRST', displayName: '첫 상품', priority: 1, weight: 100, quantity: 1 }] }], hasNext: false })
      if (path === '/api/creator/events' && method === 'POST') return response({ eventId: 28, status: 'DRAFT' }, 201)
      if (path === '/api/creator/events/28' && method === 'PATCH') return response({ eventId: 28, status: 'DRAFT' })
      if (path === '/api/creator/events/28/approval-request') {
        if (window.deferApproval) return new Promise(resolve => {
          window.resolveApproval = () => {
            resolve(response({ eventId: 28, status: 'PENDING_APPROVAL' }))
            setTimeout(() => { window.approvalSettled = true }, 0)
          }
        })
        return window.failApproval
          ? response(null, 409, 'APPROVAL_REQUEST_TOO_LATE', '이벤트 시작 최소 48시간 전까지 개설 승인을 요청해야 합니다.')
          : response({ eventId: 28, status: 'PENDING_APPROVAL' })
      }
      throw Error(`${method} ${path}`)
    }
  }, edit)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('textbox', { name: '제목', exact: false }).waitFor()
  if (!edit) {
    await page.getByRole('textbox', { name: '제목', exact: false }).fill('새 이벤트')
    await page.getByRole('spinbutton', { name: '상품 1 순위' }).fill('1')
    await page.getByRole('spinbutton', { name: '상품 1 가중치' }).fill('100')
    await page.getByRole('spinbutton', { name: '상품 1 수량' }).fill('1')
  }
  return page
}

/** 모의 API가 받은 지정 메서드·경로의 요청만 반환한다. */
function callsTo(page, method, path) {
  return page.evaluate(({ method, path }) => window.calls.filter(call => call.method === method && call.path === path), { method, path })
}

test('신규 이벤트 기본 시작 시각은 운영 승인 요청 기한보다 충분히 뒤다', async () => {
  const before = Date.now()
  const page = await openForm()
  try {
    const startAt = await page.locator('#event-start').inputValue()
    const hoursAhead = (new Date(startAt).getTime() - before) / 3600000
    assert.ok(hoursAhead > 48 && hoursAhead <= 72, `기본 시작 시각: ${hoursAhead}시간 뒤`)
  } finally { await page.close() }
})

test('초안 생성 후 승인 요청을 선택하면 생성된 eventId로 한 번 요청한다', async () => {
  const page = await openForm()
  try {
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    const dialog = page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' })
    await dialog.waitFor()
    assert.deepEqual(await page.evaluate(() => window.toasts), [])
    assert.equal((await callsTo(page, 'POST', '/api/creator/events/28/approval-request')).length, 0)
    await dialog.getByRole('button', { name: '승인 요청' }).click()
    await page.getByText('저장 완료', { exact: true }).waitFor()
    assert.equal((await callsTo(page, 'POST', '/api/creator/events')).length, 1)
    assert.equal((await callsTo(page, 'POST', '/api/creator/events/28/approval-request')).length, 1)
    assert.deepEqual(await page.evaluate(() => window.toasts), ['승인 요청을 보냈어요.'])
  } finally { await page.close() }
})

test('승인 요청 중에는 확인과 나중에를 모두 막고 응답 후 승인 완료만 안내한다', async () => {
  const page = await openForm()
  try {
    await page.evaluate(() => { window.deferApproval = true })
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    const dialog = page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' })
    await dialog.getByRole('button', { name: '승인 요청' }).click()
    await page.waitForFunction(() => typeof window.resolveApproval === 'function')
    const confirm = dialog.getByRole('button', { name: '처리하는 중...' })
    const later = dialog.getByRole('button', { name: '나중에' })
    assert.equal(await confirm.isDisabled(), true)
    assert.equal(await later.isDisabled(), true)
    await confirm.evaluate(button => button.click())
    await later.evaluate(button => button.click())
    assert.equal(await dialog.isVisible(), true)
    assert.deepEqual(await page.evaluate(() => window.toasts), [])
    assert.equal((await callsTo(page, 'POST', '/api/creator/events/28/approval-request')).length, 1)
    await page.evaluate(() => window.resolveApproval())
    await page.getByText('저장 완료', { exact: true }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.toasts), ['승인 요청을 보냈어요.'])
  } finally { await page.close() }
})

test('승인 요청 중 이전 화면으로 이동하면 늦은 응답이 다시 화면을 이동시키지 않는다', async () => {
  const page = await openForm()
  try {
    await page.evaluate(() => { window.deferApproval = true })
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    await page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' })
      .getByRole('button', { name: '승인 요청' }).click()
    await page.waitForFunction(() => typeof window.resolveApproval === 'function')
    await page.evaluate(() => window.navigateEvent(-1))
    await page.getByText('이전 화면', { exact: true }).waitFor()
    await page.evaluate(() => window.resolveApproval())
    await page.waitForFunction(() => window.approvalSettled)
    assert.equal(await page.getByText('이전 화면', { exact: true }).isVisible(), true)
    assert.deepEqual(await page.evaluate(() => window.toasts), [])
  } finally { await page.close() }
})

test('나중에를 선택하면 승인 요청 없이 초안만 남기고 이벤트 탭으로 이동한다', async () => {
  const page = await openForm()
  try {
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    await page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' }).getByRole('button', { name: '나중에' }).click()
    await page.getByText('저장 완료', { exact: true }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.toasts), ['이벤트 초안을 작성했어요.'])
    assert.equal((await callsTo(page, 'POST', '/api/creator/events')).length, 1)
    assert.equal((await callsTo(page, 'POST', '/api/creator/events/28/approval-request')).length, 0)
  } finally { await page.close() }
})

test('승인 요청이 실패해도 생성된 초안을 다시 만들지 않고 시트에 오류를 표시한다', async () => {
  const page = await openForm()
  try {
    await page.evaluate(() => { window.failApproval = true })
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    const dialog = page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' })
    await dialog.getByRole('button', { name: '승인 요청' }).click()
    await dialog.getByText('이벤트 시작 48시간 전까지만 승인을 요청할 수 있어요.').waitFor()
    assert.equal((await callsTo(page, 'POST', '/api/creator/events')).length, 1)
    assert.equal((await callsTo(page, 'POST', '/api/creator/events/28/approval-request')).length, 1)
    await dialog.getByRole('button', { name: '나중에' }).click()
    await page.getByText('저장 완료', { exact: true }).waitFor()
  } finally { await page.close() }
})

test('기존 이벤트 수정은 승인 요청 시트 없이 저장 후 이동한다', async () => {
  const page = await openForm(true)
  try {
    await page.getByRole('button', { name: '수정 저장' }).click()
    await page.getByText('저장 완료', { exact: true }).waitFor()
    assert.equal((await callsTo(page, 'PATCH', '/api/creator/events/28')).length, 1)
    assert.equal(await page.getByRole('dialog', { name: '바로 승인 요청을 보내시겠습니까?' }).count(), 0)
  } finally { await page.close() }
})
