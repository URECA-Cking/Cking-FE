import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser
const DAY = 86_400_000

// 응모 중 7개, 종료 5개. 응모 중 이벤트는 마감까지 3일 반 남겨 D-3으로 보이게 한다.
const event = (id, open) => ({
  eventId: id,
  creatorId: 1,
  title: `이벤트 ${id}`,
  status: open ? 'OPEN' : 'CLOSED',
  displayStatus: open ? 'IN_PROGRESS' : 'CLOSED',
  endAt: new Date(Date.now() + (open ? 3.5 : -2) * DAY).toISOString(),
})
const events = [...Array.from({ length: 7 }, (_, i) => event(100 + i, true)), ...Array.from({ length: 5 }, (_, i) => event(200 + i, false))]

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/myEntriesBrowser.jsx', import.meta.url)), name: 'MyEntriesTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.MY_ENTRIES_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** 외부 요청을 막고, 이벤트 목록·이벤트별 내 응모·당첨·크리에이터 목록을 경로별로 바로 응답한다. */
async function screen(winners = [], eventList = events) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/my-entries-test')
  await page.evaluate(({ events, winners }) => {
    const ok = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data, message: '' }), { status: 200, headers: { 'content-type': 'application/json' } })
    window.fetch = async (url) => {
      const path = new URL(String(url), window.location.origin).pathname
      if (path === '/api/events') return ok({ items: events, page: 0, size: 100, totalElements: events.length, totalPages: 1, hasNext: false })
      if (/^\/api\/events\/\d+\/entries\/me$/.test(path)) {
        return ok({ items: [{ usedTicketCount: 1, appliedAt: '2026-10-15T00:00:00Z' }], nextCursor: null, hasNext: false })
      }
      if (path === '/api/me/winners') return ok(winners)
      if (path === '/api/creators') return ok({ items: [], page: 0, size: 100, totalElements: 0, totalPages: 1, hasNext: false })
      throw new Error(`예상하지 못한 요청: ${path}`)
    }
  }, { events: eventList, winners })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: /^전체/ }).waitFor()
  return { page, errors }
}

const cards = (page) => page.locator('a[href^="/events/"]')

test('응모 이력을 전체·응모 중·종료로 나누고 개수를 보여 준다', async () => {
  const { page, errors } = await screen()
  try {
    assert.equal(await page.getByRole('button', { name: '전체 12' }).count(), 1)
    assert.equal(await page.getByRole('button', { name: '응모 중 7' }).count(), 1)
    assert.equal(await page.getByRole('button', { name: '종료 5' }).count(), 1)

    await page.getByRole('button', { name: '응모 중 7' }).click()
    assert.equal(await cards(page).count(), 5)
    assert.match(await cards(page).first().innerText(), /D-3/)

    // 종료된 이벤트는 날짜를 숨기고, 5개 이하라 더보기도 없다.
    await page.getByRole('button', { name: '종료 5' }).click()
    assert.equal(await cards(page).count(), 5)
    for (const text of await cards(page).allInnerTexts()) assert.doesNotMatch(text, /D-/)
    assert.equal(await page.getByRole('button', { name: /더보기|접기/ }).count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('더보기는 5개씩 늘리고 끝까지 펼치면 접기로 처음 5개로 돌아간다', async () => {
  const { page, errors } = await screen()
  try {
    assert.equal(await cards(page).count(), 5)
    await page.getByRole('button', { name: '더보기 (7개)' }).click()
    assert.equal(await cards(page).count(), 10)
    await page.getByRole('button', { name: '더보기 (2개)' }).click()
    assert.equal(await cards(page).count(), 12)
    await page.getByRole('button', { name: '접기' }).click()
    assert.equal(await cards(page).count(), 5)

    // 필터를 바꾸면 펼친 개수도 처음으로 돌아간다.
    await page.getByRole('button', { name: '더보기 (7개)' }).click()
    await page.getByRole('button', { name: '응모 중 7' }).click()
    assert.equal(await cards(page).count(), 5)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('당첨을 포기하거나 자격이 박탈된 이벤트는 "당첨!" 대신 상태로 보여 주고 강조하지 않는다', async () => {
  // 종료 이벤트 200~202만 결과가 공개된 상태로 만든다(공개돼야 당첨 여부를 보여 준다).
  const published = events.map((item) => (item.eventId >= 200 && item.eventId <= 202 ? { ...item, status: 'PUBLISHED' } : item))
  const win = (eventId, winnerManagementStatus) => ({ winnerId: eventId, eventId, drawNo: 0, drawType: 'INITIAL', rankInDrawing: 1, prizeDisplayName: 'Grand prize', winnerManagementStatus })
  const { page, errors } = await screen([win(200, 'SELECTED'), win(201, 'DECLINED'), win(202, 'DISQUALIFIED')], published)
  try {
    await page.getByRole('button', { name: '종료 5' }).click()
    const card = (eventId) => page.locator(`a[href="/events/${eventId}"]`)

    assert.match(await card(200).innerText(), /당첨!/)
    assert.match(await card(200).getAttribute('class'), /border-primary/)

    assert.match(await card(201).innerText(), /당첨 포기/)
    assert.doesNotMatch(await card(201).innerText(), /당첨!/)
    assert.doesNotMatch(await card(201).getAttribute('class'), /border-primary/)

    assert.match(await card(202).innerText(), /자격 박탈/)
    assert.doesNotMatch(await card(202).innerText(), /당첨!/)
    assert.doesNotMatch(await card(202).getAttribute('class'), /border-primary/)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
