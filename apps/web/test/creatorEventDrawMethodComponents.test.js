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
async function openForm(edit = false, initialMethod = 'WEIGHTED', touch = false) {
  const page = await browser.newPage(touch ? { hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } } : {})
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

test('종료 시각이 2000~2099년 밖(다섯 자리 연도)이면 저장하지 않고 범위를 안내한다', async () => {
  const page = await openForm()
  try {
    // 브라우저 날짜 입력은 10000년 같은 다섯 자리 연도를 값으로 받는다. React 입력처럼 값을 바꿔 그 상황을 만든다.
    await page.locator('#event-end').evaluate(element => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '10000-12-25T01:01')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(await page.locator('#event-end').inputValue(), '10000-12-25T01:01')
    await page.getByRole('button', { name: '이벤트 초안 작성' }).click()
    await page.getByText('날짜는 2000년부터 2099년 사이로 입력해주세요.').waitFor()
    assert.deepEqual(await callsTo(page, 'POST', '/api/creator/events'), [])
  } finally { await page.close() }
})

test('모바일 너비에서 두 방식의 한국어 이름을 표시한다', async () => {
  const page = await openForm()
  try {
    await page.setViewportSize({ width: 375, height: 812 })
    const select = page.getByRole('combobox', { name: '추첨 방식' })
    await select.selectOption('WEIGHTED')
    if (process.env.DRAW_METHOD_SCREENSHOT) {
      await select.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await page.screenshot({ path: process.env.DRAW_METHOD_SCREENSHOT })
    }
    assert.ok(await select.isVisible())
    const winnerBox = await page.locator('#event-winner-count').boundingBox()
    const methodBox = await select.boundingBox()
    assert.equal(methodBox.y, winnerBox.y)
    assert.ok(Math.abs(methodBox.width - winnerBox.width) <= 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  } finally { await page.close() }
})


test('320px에서도 선택 문구 전체가 입력창 안에 표시되고 기존 2열 배치를 유지한다', async () => {
  const page = await openForm()
  try {
    await page.setViewportSize({ width: 320, height: 812 })
    const select = page.getByRole('combobox', { name: '추첨 방식' })
    await select.selectOption('WEIGHTED')
    const text = select.locator('..').locator('span[aria-hidden="true"]')
    assert.equal(await text.textContent().then(value => value.trim()), '응모권 수 비례 추첨')
    assert.ok(await text.evaluate(element => element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth))
    assert.equal((await select.boundingBox()).y, (await page.locator('#event-winner-count').boundingBox()).y)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  } finally { await page.close() }
})

test('추첨 방식·가중치 도움말은 hover와 focus로 열리고 이탈과 Escape로 닫힌다', async () => {
  const page = await openForm()
  try {
    await page.setViewportSize({ width: 375, height: 812 })
    for (const label of ['추첨 방식 도움말', '상품 1 가중치 도움말']) {
      const button = page.getByRole('button', { name: label, exact: true })
      assert.equal(await page.getByRole('tooltip').count(), 0)
      await button.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await button.hover()
      const tooltip = page.getByRole('tooltip')
      await tooltip.waitFor()
      const box = await tooltip.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= 375)
      if (label.startsWith('추첨')) assert.match(await tooltip.textContent(), /참여자별 동일한 당첨 확률/)
      else assert.match(await tooltip.textContent(), /상품 배정의 상대 비율/)
      if (process.env.DRAW_METHOD_SCREENSHOT) {
        await page.screenshot({ path: process.env.DRAW_METHOD_SCREENSHOT.replace('.png', label.startsWith('추첨') ? '-help.png' : '-weight-help.png') })
      }
      await page.mouse.move(0, 0)
      await tooltip.waitFor({ state: 'detached' })
      await button.focus()
      await tooltip.waitFor()
      await page.keyboard.press('Escape')
      await tooltip.waitFor({ state: 'detached' })
      await page.locator('#event-title').focus()
    }
    assert.equal((await callsTo(page, 'POST', '/api/creator/events')).length, 0)
  } finally { await page.close() }
})


test('모바일 터치로 도움말을 열고 재터치·바깥 터치로 닫으며 다른 도움말로 전환한다', async () => {
  const page = await openForm(false, 'WEIGHTED', true)
  try {
    const method = page.getByRole('button', { name: '추첨 방식 도움말', exact: true })
    const weight = page.getByRole('button', { name: '상품 1 가중치 도움말', exact: true })
    for (const button of [method, weight]) {
      await button.tap()
      await page.getByRole('tooltip').waitFor()
      assert.equal(await button.getAttribute('aria-expanded'), 'true')
      await button.tap()
      await page.getByRole('tooltip').waitFor({ state: 'detached' })
      await button.tap()
      await page.getByRole('tooltip').waitFor()
      // focus를 받지 않는 바깥 제목을 눌러도 닫혀야 한다.
      await page.getByRole('heading', { name: '상품 등급', exact: true }).tap()
      await page.getByRole('tooltip').waitFor({ state: 'detached' })
    }
    await method.tap()
    await weight.tap()
    assert.equal(await page.getByRole('tooltip').count(), 1)
    assert.equal(await method.getAttribute('aria-expanded'), 'false')
    assert.equal(await weight.getAttribute('aria-expanded'), 'true')
    assert.match(await page.getByRole('tooltip').textContent(), /단일 상품·균등 배정 시 미적용/)
    assert.equal((await callsTo(page, 'POST', '/api/creator/events')).length, 0)
  } finally { await page.close() }
})
