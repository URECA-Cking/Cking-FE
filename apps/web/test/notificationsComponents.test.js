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

test('당첨·미당첨 결과 알림은 유형과 서버 문구를 표시하고 읽음 처리 후 해당 이벤트로 이동한다', async () => {
  const cases = [
    { type: 'INITIAL_WINNER', label: '최초 당첨', icon: 'celebration' },
    { type: 'REDRAW_WINNER', label: '재추첨 당첨', icon: 'autorenew' },
    { type: 'INITIAL_NON_WINNER', label: '이벤트 결과 발표', icon: 'campaign' },
  ]

  for (const [index, variant] of cases.entries()) {
    const { page, errors } = await screen()
    const eventId = 41 + index
    const notification = {
      ...item(index + 1), type: variant.type, title: `서버 제목 ${variant.type}`,
      body: `서버 본문 ${variant.type}`, event: { eventId, title: `이벤트 ${eventId}` },
      drawing: { drawingId: index + 1, drawNo: index, drawType: index === 1 ? 'REDRAW' : 'INITIAL' },
    }
    try {
      await requestCount(page, 1)
      await page.evaluate((data) => window.respond(0, data), list([notification]))
      await page.getByRole('button', { name: '알림 열기' }).click()
      await requestCount(page, 2)
      await page.evaluate((data) => window.respond(1, data), list([notification]))

      const card = page.getByRole('button', { name: new RegExp(`서버 제목 ${variant.type}`) })
      await card.waitFor()
      assert.equal(await card.getByText(variant.label, { exact: true }).count(), 1)
      assert.equal(await card.getByText(variant.icon, { exact: true }).count(), 1)
      assert.equal(await card.getByText(notification.title, { exact: true }).count(), 1)
      assert.equal(await card.getByText(notification.body, { exact: true }).count(), 1)
      await card.click()

      await requestCount(page, 3)
      assert.match(await page.evaluate(() => window.requests[2].url), new RegExp(`/api/me/notifications/${notification.notificationId}/read$`))
      await page.evaluate(() => window.respond(2, { readAt: '2026-10-15T01:00:00Z' }))
      await page.getByText(`이벤트 상세 ${eventId}`).waitFor()
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  }
})

/** 제목이 같은 알림 카드 버튼. 삭제 버튼은 글자가 "삭제"뿐이라 섞이지 않는다. */
const card = (page, title) => page.locator('button', { hasText: title })

/** 알림 카드를 마우스로 왼쪽으로 끌어 삭제 버튼을 연다. */
async function swipeOpen(page, title) {
  const box = await card(page, title).boundingBox()
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width - 20, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 60, y + 2, { steps: 4 })
  await page.mouse.move(box.x + box.width - 140, y + 2, { steps: 4 })
  await page.mouse.up()
}

/** 알림 카드를 마우스로 카드 너비의 85%만큼 끝까지 밀고 놓지는 않는다(바로 삭제 기준 65%를 넘긴다). */
async function dragFar(page, title) {
  // 판정 기준은 스와이프 영역(카드 버튼의 부모)의 너비다. 이 테스트 화면은 CSS가 없어 버튼이 글자 폭만큼만 차지하므로
  // 카드 버튼이 아니라 영역의 너비로 거리를 잡고, 영역의 오른쪽 끝에서 눌러 왼쪽으로 끈다.
  const cardBox = await card(page, title).boundingBox()
  const area = await card(page, title).locator('..').boundingBox()
  const y = cardBox.y + cardBox.height / 2
  const startX = area.x + area.width - 10
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(startX - 50, y + 2, { steps: 4 })
  await page.mouse.move(startX - area.width * 0.85, y + 2, { steps: 8 })
  // 놓기 전에 "놓으면 삭제" 안내가 보여야 한다(기준을 넘겼는지 확인).
  await page.getByText('놓으면 삭제').waitFor({ timeout: 5000 })
}

/** 알림 카드를 끝까지 밀었다가 놓는다. */
async function swipeFar(page, title) {
  await dragFar(page, title)
  await page.mouse.up()
}

/** 알림 화면에 들어가 레이아웃 조회(0)와 화면 진입 조회(1)에 같은 목록으로 응답한다. */
async function openNotifications(page, items) {
  await requestCount(page, 1)
  await page.evaluate((data) => window.respond(0, data), list(items))
  await page.getByRole('button', { name: '알림 열기' }).click()
  await requestCount(page, 2)
  await page.evaluate((data) => window.respond(1, data), list(items))
}

test('왼쪽으로 밀어도 삭제되지 않고 삭제 버튼을 눌러야 삭제되며 목록과 안 읽은 알림 수가 바로 줄어든다', async () => {
  const { page, errors } = await screen()
  try {
    await openNotifications(page, [item(1), item(2)])
    await card(page, '알림 1').waitFor()
    await page.getByText('읽지 않은 알림 2개').waitFor()
    await swipeOpen(page, '알림 1')
    // 밀기만으로는 알림을 열거나 삭제하지 않는다.
    assert.equal(await page.evaluate(() => window.requests.length), 2)
    assert.equal(await card(page, '알림 1').count(), 1)
    await page.getByRole('button', { name: '알림 삭제: 알림 1' }).click()
    await requestCount(page, 3)
    assert.match(await page.evaluate(() => window.requests[2].url), /\/api\/me\/notifications\/1\/hide$/)
    assert.equal(await page.evaluate(() => window.requests[2].method), 'PATCH')
    // 서버 응답 전에 목록과 안 읽은 알림 수에서 먼저 빠진다(알림 화면은 종 배지를 숨기므로 화면의 건수를 본다).
    await card(page, '알림 1').waitFor({ state: 'detached' })
    await page.getByText('읽지 않은 알림 1개').waitFor()
    await page.evaluate(() => window.respond(2, { notificationId: 1, hiddenAt: '2026-10-16T00:00:00Z' }))
    // 성공하면 서버 기준으로 목록을 다시 맞춘다.
    await requestCount(page, 4)
    await page.evaluate((data) => window.respond(3, data), list([item(2)]))
    assert.equal(await card(page, '알림 2').count(), 1)
    assert.equal(await card(page, '알림 1').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('삭제에 실패하면 알림과 안 읽은 알림 수를 되돌리고 오류를 알린다', async () => {
  const { page, errors } = await screen()
  try {
    await openNotifications(page, [item(1), item(2)])
    await card(page, '알림 1').waitFor()
    await swipeOpen(page, '알림 1')
    await page.getByRole('button', { name: '알림 삭제: 알림 1' }).click()
    await requestCount(page, 3)
    await page.evaluate(() => window.respond(2, null, 500))
    await requestCount(page, 4)
    await page.evaluate((data) => window.respond(3, data), list([item(1), item(2)]))
    await card(page, '알림 1').waitFor()
    await page.getByText('읽지 않은 알림 2개').waitFor()
    assert.equal(await page.evaluate(() => window.toasts.length), 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('삭제한 직후 늦게 도착한 오래된 목록 응답이 삭제한 알림을 되살리지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await requestCount(page, 1)
    await page.evaluate((data) => window.respond(0, data), list([item(1), item(2)]))
    await page.getByRole('button', { name: '알림 열기' }).click()
    await requestCount(page, 2)
    // 화면 진입 조회(1)가 끝나기 전에 레이아웃이 가진 목록으로 삭제한다.
    await card(page, '알림 1').waitFor()
    await swipeOpen(page, '알림 1')
    await page.getByRole('button', { name: '알림 삭제: 알림 1' }).click()
    await requestCount(page, 3)
    await page.evaluate(() => window.respond(2, { notificationId: 1, hiddenAt: '2026-10-16T00:00:00Z' }))
    // 삭제하기 전에 시작한 오래된 응답이 알림 1을 담은 채 늦게 도착해도 목록에 나타나지 않는다.
    await page.evaluate((data) => window.respond(1, data), list([item(1), item(2)]))
    await card(page, '알림 2').waitFor()
    assert.equal(await card(page, '알림 1').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('열린 카드는 Esc로 닫히고 삭제 요청은 보내지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await openNotifications(page, [item(1), item(2)])
    await card(page, '알림 1').waitFor()
    await swipeOpen(page, '알림 1')
    await page.getByRole('button', { name: '알림 삭제: 알림 1' }).waitFor()
    await page.keyboard.press('Escape')
    // 닫히면 삭제 버튼은 접근성 트리에서 빠지고 카드는 그대로 남는다.
    await page.getByRole('button', { name: '알림 삭제: 알림 1' }).waitFor({ state: 'detached' })
    assert.equal(await card(page, '알림 1').count(), 1)
    assert.equal(await page.evaluate(() => window.requests.length), 2)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('끝까지 밀고 놓으면 삭제 버튼을 누르지 않아도 바로 삭제 요청을 보내고 알림을 열지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await openNotifications(page, [item(1), item(2)])
    await card(page, '알림 1').waitFor()
    await swipeFar(page, '알림 1')
    await requestCount(page, 3)
    assert.match(await page.evaluate(() => window.requests[2].url), /\/api\/me\/notifications\/1\/hide$/)
    assert.equal(await page.evaluate(() => window.requests[2].method), 'PATCH')
    // 읽음 요청(알림 열기)은 가지 않는다. 서버 응답 전에 목록과 안 읽은 알림 수에서 먼저 빠진다.
    assert.equal(await page.evaluate(() => window.requests.filter((request) => request.url.endsWith('/read')).length), 0)
    await card(page, '알림 1').waitFor({ state: 'detached' })
    await page.getByText('읽지 않은 알림 1개').waitFor()
    await page.evaluate(() => window.respond(2, { notificationId: 1, hiddenAt: '2026-10-16T00:00:00Z' }))
    await requestCount(page, 4)
    await page.evaluate((data) => window.respond(3, data), list([item(2)]))
    assert.equal(await card(page, '알림 2').count(), 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('끝까지 끌던 중 입력이 취소(pointercancel)되면 삭제하지 않고 카드를 원래 자리로 되돌린다', async () => {
  const { page, errors } = await screen()
  try {
    await openNotifications(page, [item(1), item(2)])
    await card(page, '알림 1').waitFor()
    // 실제 마우스 이벤트의 pointerId를 기록해 두었다가 같은 ID로 취소 이벤트를 보낸다(브라우저·OS의 입력 취소를 흉내 낸다).
    await page.evaluate(() => {
      document.addEventListener('pointermove', (event) => { window.lastPointerId = event.pointerId }, true)
    })
    await dragFar(page, '알림 1')
    await page.evaluate((title) => {
      const area = [...document.querySelectorAll('button')].find((button) => button.textContent.includes(title)).parentElement
      area.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.lastPointerId, pointerType: 'mouse', bubbles: true }))
    }, '알림 1')
    // 안내가 사라지고 카드가 제자리로 돌아온다.
    await page.getByText('놓으면 삭제').waitFor({ state: 'detached' })
    // 취소 뒤 실제로 손을 놓아도 삭제가 확정되지 않는다.
    await page.mouse.up()
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => window.requests.length), 2)
    assert.equal(await card(page, '알림 1').count(), 1)
    await page.getByText('읽지 않은 알림 2개').waitFor()
    assert.equal(await page.evaluate(() => window.requests.filter((request) => request.url.endsWith('/hide')).length), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
