import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let browser, bundle, css
const pageErrors = []

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent', define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://event.test'), 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/eventPrizeKeysBrowser.jsx', import.meta.url)), name: 'EventApprovalTest', formats: ['iife'] } } })
  css = (Array.isArray(output) ? output[0] : output).output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css')).source
  bundle = (Array.isArray(output) ? output[0] : output).output.find(asset => asset.type === 'chunk').code
  const paths = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {} })
})

test.after(async () => {
  await browser?.close()
  assert.deepEqual(pageErrors, [])
})

/** Creator 이벤트 생성·수정 API를 흉내 내고 해당 폼을 브라우저에 연다. */
async function openForm(edit = false, initialMethod = 'WEIGHTED') {
  const page = await browser.newPage()
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    : route.abort())
  await page.goto('http://localhost/event-form')
  await page.evaluate(({ editMode, initialMethod }) => {
    window.eventPath = editMode ? '/creator/events/28/edit' : '/creator/events/new'
    window.savedMethod = initialMethod
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
      if (path === '/api/creator/events' && method === 'GET') return response({ items: [{ eventId: 28, title: '기존 이벤트', description: '', drawMethod: window.savedMethod, prizeAlgorithmVersion: 'PRIZE_UNIFORM_V1', winnerCount: 1, startAt: '2030-01-01T01:00:00Z', endAt: '2030-02-01T01:00:00Z', prizes: [{ prizeKey: 'FIRST', displayName: '첫 상품', priority: 1, weight: 100, quantity: 1 }] }], hasNext: false })
      if (path === '/api/creator/events' && method === 'POST') { window.savedMethod = JSON.parse(options.body).drawMethod; return response({ eventId: 28, status: 'DRAFT' }, 201) }
      if (path === '/api/creator/events/28' && method === 'PATCH') { window.savedMethod = JSON.parse(options.body).drawMethod; return response({ eventId: 28, status: 'DRAFT' }) }
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
  }, { editMode: edit, initialMethod })
  await page.addStyleTag({ content: css })
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


for (const method of ['UNIFORM', 'WEIGHTED']) {
  test(`신규 이벤트에서 ${method}를 선택하면 POST로 저장하고 수정 화면에서 복원한다`, async () => {
    const page = await openForm()
    try {
      const select = page.getByRole('combobox', { name: '추첨 방식' })
      assert.equal(await select.inputValue(), 'WEIGHTED')
      assert.deepEqual(await select.locator('option').allTextContents(), ['동일 확률 추첨', '응모권 수 비례 추첨'])
      await select.selectOption(method)
      await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
      await page.getByRole('dialog').getByRole('button', { name: '나중에' }).click()
      await page.getByText('저장 완료', { exact: true }).waitFor()
      const calls = await callsTo(page, 'POST', '/api/creator/events')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].body.drawMethod, method)
      await page.evaluate(() => window.navigateEvent('/creator/events/28/edit'))
      await page.getByRole('combobox', { name: '추첨 방식' }).waitFor()
      assert.equal(await page.getByRole('combobox', { name: '추첨 방식' }).inputValue(), method)
    } finally { await page.close() }
  })

  test(`기존 ${method} 값을 복원하고 반대 방식으로 PATCH 후 재진입해도 유지한다`, async () => {
    const page = await openForm(true, method)
    try {
      const select = page.getByRole('combobox', { name: '추첨 방식' })
      assert.equal(await select.inputValue(), method)
      const changed = method === 'UNIFORM' ? 'WEIGHTED' : 'UNIFORM'
      await select.selectOption(changed)
      await page.getByRole('button', { name: '수정 저장' }).click()
      await page.getByText('저장 완료', { exact: true }).waitFor()
      const calls = await callsTo(page, 'PATCH', '/api/creator/events/28')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].body.drawMethod, changed)
      assert.equal(calls[0].body.prizeAlgorithmVersion, 'PRIZE_UNIFORM_V1')
      await page.evaluate(() => window.navigateEvent('/creator/events/28/edit'))
      await page.getByRole('combobox', { name: '추첨 방식' }).waitFor()
      assert.equal(await page.getByRole('combobox', { name: '추첨 방식' }).inputValue(), changed)
    } finally { await page.close() }
  })
}

test('모바일 너비에서 두 방식의 한국어 이름을 표시한다', async () => {
  const page = await openForm()
  try {
    await page.setViewportSize({ width: 375, height: 812 })
    const select = page.getByRole('combobox', { name: '추첨 방식' })
    await select.selectOption('WEIGHTED')
    if (process.env.DRAW_METHOD_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAW_METHOD_SCREENSHOT, fullPage: true })
    }
    assert.ok(await select.isVisible())
    assert.ok((await select.boundingBox()).width >= 300)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  } finally { await page.close() }
})
