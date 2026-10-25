import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 일정 편집 시트의 종일: 날짜만 고르고, 시간대 기준 첫날 0시 ~ 마지막 날 다음 날 0시로 저장한다.
let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/scheduleAllDayBrowser.jsx', import.meta.url)), name: 'ScheduleAllDay', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen(schedule = null) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/schedule-all-day')
  await page.evaluate(() => {
    window.saved = []
    window.requests = []
    window.fetch = async (url, options) => {
      const body = JSON.parse(options.body)
      window.requests.push({ method: options.method, path: new URL(url, location.href).pathname, body })
      return new Response(JSON.stringify({ code: 'SUCCESS', data: { scheduleId: 7, ...body } }), { status: 200 })
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((value) => window.renderEditor(value), schedule)
  const editor = page.getByRole('dialog')
  await editor.waitFor()
  return { page, editor }
}
const allDaySwitch = (editor) => editor.getByRole('switch', { name: '종일' })

test('종일을 켜면 날짜만 고르고, 서울 10/10~10/11은 10/9 15:00Z ~ 10/11 15:00Z로 저장한다', async () => {
  const { page, editor } = await screen()
  try {
    await editor.locator('input[type="text"]').first().fill('생일 주간')
    await allDaySwitch(editor).click()
    assert.equal(await allDaySwitch(editor).getAttribute('aria-checked'), 'true')
    const dates = editor.locator('input[type="date"]')
    await dates.nth(0).fill('2026-10-10')
    await dates.nth(1).fill('2026-10-09')
    await editor.getByText('종료일은 시작일보다 빠를 수 없어요.').waitFor()
    assert.equal(await editor.getByRole('button', { name: '일정 등록', exact: true }).isDisabled(), true)
    await dates.nth(1).fill('2026-10-11')
    await editor.getByRole('button', { name: '일정 등록', exact: true }).click()
    await page.waitForFunction(() => window.saved.length === 1)
    const [request] = await page.evaluate(() => window.requests)
    assert.equal(request.method, 'POST')
    assert.equal(request.path, '/api/creator/calendar/schedules')
    assert.equal(request.body.allDay, true)
    assert.equal(request.body.timeZone, 'Asia/Seoul')
    assert.equal(request.body.startAt, '2026-10-09T15:00:00.000Z')
    assert.equal(request.body.endAt, '2026-10-11T15:00:00.000Z')
  } finally { await page.close() }
})

test('종일을 켰다 끄면 입력해 둔 시각이 돌아오고 시간 일정으로 저장한다', async () => {
  const { page, editor } = await screen()
  try {
    await editor.locator('input[type="text"]').first().fill('팬사인회')
    const times = editor.locator('input[type="datetime-local"]')
    await times.nth(0).fill('2026-10-10T14:00')
    await times.nth(1).fill('2026-10-10T16:30')
    await allDaySwitch(editor).click()
    assert.equal(await editor.locator('input[type="date"]').nth(0).inputValue(), '2026-10-10')
    await allDaySwitch(editor).click()
    assert.equal(await times.nth(0).inputValue(), '2026-10-10T14:00')
    assert.equal(await times.nth(1).inputValue(), '2026-10-10T16:30')
    await editor.getByRole('button', { name: '일정 등록', exact: true }).click()
    await page.waitForFunction(() => window.saved.length === 1)
    const [request] = await page.evaluate(() => window.requests)
    assert.equal(request.body.allDay, false)
    assert.equal(request.body.startAt, '2026-10-10T05:00:00.000Z')
    assert.equal(request.body.endAt, '2026-10-10T07:30:00.000Z')
  } finally { await page.close() }
})

test('저장된 종일 일정을 열면 마지막 날을 종료일로 보여 주고, 날짜만 바꿔 저장해도 종일로 보낸다', async () => {
  const schedule = {
    scheduleId: 7, scheduleType: 'BIRTHDAY', title: '생일', description: null,
    startAt: '2026-10-09T15:00:00Z', endAt: '2026-10-11T15:00:00Z', allDay: true, timeZone: 'Asia/Seoul',
    location: null, imageUrl: null, externalUrl: null,
  }
  const { page, editor } = await screen(schedule)
  try {
    assert.equal(await allDaySwitch(editor).getAttribute('aria-checked'), 'true')
    const dates = editor.locator('input[type="date"]')
    assert.equal(await dates.nth(0).inputValue(), '2026-10-10')
    assert.equal(await dates.nth(1).inputValue(), '2026-10-11')
    await dates.nth(1).fill('2026-10-12')
    await editor.getByRole('button', { name: '수정 저장', exact: true }).click()
    await page.waitForFunction(() => window.saved.length === 1)
    const [request] = await page.evaluate(() => window.requests)
    assert.equal(request.method, 'PATCH')
    assert.equal(request.path, '/api/creator/calendar/schedules/7')
    assert.equal(request.body.allDay, true)
    assert.equal(request.body.startAt, '2026-10-09T15:00:00.000Z')
    assert.equal(request.body.endAt, '2026-10-12T15:00:00.000Z')
  } finally { await page.close() }
})
