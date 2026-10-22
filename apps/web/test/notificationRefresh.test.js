import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let browser, bundle, styles
const item = (id) => ({ notificationId: id, type: 'COMMON_TICKET_REWARDED', title: `지급 알림 ${id}`, body: '출석 보상으로 공용 응모권 1장이 지급됐어요.', createdAt: '2026-10-22T00:00:00Z', readAt: null, event: null, drawing: null })
const list = (...items) => ({ items, page: 0, hasNext: false })

test.before(async () => {
  const result = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/notificationRefreshBrowser.jsx', import.meta.url)), name: 'RefreshTest', formats: ['iife'] } },
  })
  const output = (Array.isArray(result) ? result[0] : result).output
  bundle = output.find((part) => part.type === 'chunk').code
  styles = output.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(existsSync)
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen(initial = list()) {
  const page = await browser.newPage()
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/refresh-test')
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.addStyleTag({ content: styles })
  await page.evaluate(() => {
    window.requests = []
    window.toasts = []
    window.fetch = (url, options) => new Promise((resolve) => {
      window.requests.push({ url: String(url), method: options.method, resolve })
    })
    window.respond = (index, data, status = 200) => window.requests[index].resolve(new Response(
      JSON.stringify({ code: status === 200 ? 'SUCCESS' : 'ERROR', data, message: '조회 실패' }), { status },
    ))
  })
  await page.addScriptTag({ content: bundle })
  await page.waitForFunction(() => window.requests.length === 1)
  await respond(page, 0, initial)
  return page
}

async function respond(page, index, data, status = 200) {
  await page.evaluate(({ index, data, status }) => window.respond(index, data, status), { index, data, status })
  await flush(page)
}

// React의 MessageChannel 작업과 effect를 실제 브라우저 프레임으로 완료한다. 임의 sleep은 사용하지 않는다.
async function flush(page) {
  const frame = page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.clock.runFor(34)
  await frame
}

async function total(page, value) {
  await page.evaluate((value) => window.setTotal(value), value)
  await flush(page)
}

async function count(page) { return page.evaluate(() => window.requests.length) }

test('최초 로딩·동일·감소·null에서는 재조회하지 않는다', async () => {
  const page = await screen()
  try {
    for (const value of [10, 10, 9, null, 15]) {
      await total(page, value)
      await page.clock.runFor(6000)
      assert.equal(await count(page), 1)
    }
  } finally { await page.close() }
})

test('증가 후 지연 두 번만 조회하고 새 알림 종을 갱신한다', async () => {
  const page = await screen()
  try {
    await total(page, 10)
    await total(page, 11)
    await page.clock.runFor(2400)
    assert.equal(await count(page), 1)
    await page.clock.runFor(100)
    assert.equal(await count(page), 2)
    await respond(page, 1, list(item(1)))
    assert.equal(await page.getByLabel('읽지 않은 알림 1개').count(), 1)
    await page.clock.runFor(3000)
    assert.equal(await count(page), 3)
    await respond(page, 2, list(item(2), item(1)))
    assert.equal(await page.getByLabel('읽지 않은 알림 2개').count(), 1)
    await page.clock.runFor(60000)
    assert.equal(await count(page), 3)
  } finally { await page.close() }
})

test('연속 증가는 기존 두 예약에 합치고 끝난 뒤 새 증가만 새로 예약한다', async () => {
  const page = await screen()
  try {
    await total(page, 1)
    await total(page, 2)
    await total(page, 3)
    await page.clock.runFor(2500)
    assert.equal(await count(page), 2)
    await total(page, 4)
    await page.clock.runFor(3000)
    assert.equal(await count(page), 3)
    await page.clock.runFor(10000)
    assert.equal(await count(page), 3)
    await total(page, 5)
    await page.clock.runFor(5500)
    assert.equal(await count(page), 5)
  } finally { await page.close() }
})

for (const action of ['route', 'unmount', 'logout', 'member']) {
  test(`${action}: 이전 예약과 사용자 상태를 정리한다`, async () => {
    const page = await screen()
    try {
      await total(page, 10)
      await total(page, 11)
      await page.evaluate((action) => {
        if (action === 'route') window.navigate('/explore')
        if (action === 'unmount') window.unmountLayout()
        if (action === 'logout') window.setMember(null)
        if (action === 'member') { window.setMember(2); window.setTotal(null) }
      }, action)
      await flush(page)
      const expected = action === 'member' ? 2 : 1
      assert.equal(await count(page), expected)
      await page.clock.runFor(10000)
      assert.equal(await count(page), expected)
      if (action === 'member') {
        await respond(page, 1, list())
        await total(page, 100)
        await page.clock.runFor(6000)
        assert.equal(await count(page), 2)
      }
    } finally { await page.close() }
  })
}

test('이전 사용자의 지연 응답은 새 사용자 알림을 덮지 않는다', async () => {
  const page = await screen()
  try {
    await total(page, 1)
    await total(page, 2)
    await page.clock.runFor(2500)
    await page.evaluate(() => { window.setMember(2); window.setTotal(null) })
    await flush(page)
    assert.equal(await count(page), 3)
    await respond(page, 2, list(item(20)))
    await respond(page, 1, list(item(1), item(2)))
    assert.equal(await page.getByLabel('읽지 않은 알림 1개').count(), 1)
    await page.clock.runFor(10000)
    assert.equal(await count(page), 3)
  } finally { await page.close() }
})

test('첫 조회 이후 화면을 떠나면 두 번째 예약도 취소한다', async () => {
  const page = await screen()
  try {
    await total(page, 1)
    await total(page, 2)
    await page.clock.runFor(2500)
    assert.equal(await count(page), 2)
    await page.evaluate(() => window.navigate('/explore'))
    await flush(page)
    await page.clock.runFor(10000)
    assert.equal(await count(page), 2)
  } finally { await page.close() }
})

test('조회 실패에도 기존 배지를 유지하고 두 번째 조회로 복구한다', async () => {
  const page = await screen(list(item(1)))
  try {
    await total(page, 1)
    await total(page, 2)
    await page.clock.runFor(2500)
    await respond(page, 1, null, 500)
    assert.equal(await page.getByLabel('읽지 않은 알림 1개').count(), 1)
    assert.deepEqual(await page.evaluate(() => window.toasts), [])
    await page.clock.runFor(3000)
    await respond(page, 2, list(item(1), item(2)))
    assert.equal(await page.getByLabel('읽지 않은 알림 2개').count(), 1)
    await page.clock.runFor(10000)
    assert.equal(await count(page), 3)
  } finally { await page.close() }
})

test('지연 GET에도 읽음·숨김·펼침을 유지하고 새 알림을 표시한다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.navigate('/notifications'))
    await flush(page)
    await respond(page, 1, list(item(1), item(2)))
    await total(page, 1)
    await total(page, 2)
    await page.clock.runFor(2500)
    assert.equal(await count(page), 3)
    await page.getByRole('button', { name: /지급 알림 1/ }).click()
    await respond(page, 3, { readAt: '2026-10-22T01:00:00Z' })
    const box = await page.getByRole('button', { name: /지급 알림 2/ }).boundingBox()
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2, { steps: 4 })
    await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
    await page.clock.runFor(300)
    await page.getByRole('button', { name: '알림 삭제: 지급 알림 2', exact: true }).click()
    await flush(page)
    await respond(page, 2, list(item(1), item(2), item(3)))
    assert.equal(await page.getByRole('button', { name: /지급 알림 1/ }).getAttribute('aria-expanded'), 'true')
    assert.equal(await page.getByRole('button', { name: /지급 알림 2/ }).count(), 0)
    assert.equal(await page.getByRole('button', { name: /지급 알림 3/ }).count(), 1)
  } finally { await page.close() }
})
