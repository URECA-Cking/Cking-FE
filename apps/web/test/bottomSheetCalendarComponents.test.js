import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/bottomSheetCalendarBrowser.jsx', import.meta.url)), name: 'UI261', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })
async function screen(theme, width) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: `<html data-theme="${theme}"><body><div id="root"></div></body></html>` }) : route.abort())
  await page.goto('http://localhost/ui261')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '공통 열기' }).waitFor()
  return page
}
for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
  test(`${theme} ${width}px: 공통·신고·차단 시트의 전체 배경과 드래그 확장`, async () => {
    const page = await screen(theme, width)
    try {
      for (const variant of ['공통', '신고', '차단']) {
        await page.getByRole('button', { name: `${variant} 열기` }).click()
        const panel = page.getByRole('dialog')
        await panel.waitFor()
        const overlay = await panel.evaluate((node) => {
          const backdrop = node.parentElement
          return { portal: backdrop.parentElement === document.body, color: getComputedStyle(backdrop).backgroundColor,
            top: backdrop.getBoundingClientRect().top, height: backdrop.getBoundingClientRect().height,
            hit: backdrop.contains(document.elementFromPoint(15, 25)), overflow: document.body.style.overflow }
        })
        assert.deepEqual(overlay, { portal: true, color: 'rgba(0, 0, 0, 0.6)', top: 0, height: 844, hit: true, overflow: 'hidden' })
        const handle = page.getByRole('button', { name: '시트 확장' })
        const box = await handle.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2, box.y - 65, { steps: 8 })
        await page.mouse.up()
        await page.getByRole('button', { name: '시트 접기' }).waitFor()
        assert.ok((await panel.boundingBox()).height > 800)
        await page.keyboard.press('Escape')
        await panel.waitFor({ state: 'detached' })
        assert.equal(await page.evaluate(() => document.body.style.overflow), '')
        await page.getByRole('button', { name: `${variant} 열기` }).click()
        await page.getByRole('button', { name: '시트 확장' }).waitFor()
        await page.getByRole('button', { name: '닫기', exact: true }).click()
      }
    } finally { await page.close() }
  })
  test(`${theme} ${width}px: 오늘 테두리와 선택 유지·토요일 파란색·버튼 제거`, async () => {
    const page = await screen(theme, width)
    try {
      const today = page.getByRole('button', { name: '10월 20일', exact: true })
      const other = page.getByRole('button', { name: '10월 21일', exact: true })
      const style = (button) => button.locator('span').first().evaluate((node) => ({ background: getComputedStyle(node).backgroundColor, shadow: getComputedStyle(node).boxShadow }))
      assert.equal(await today.getAttribute('aria-current'), 'date')
      const selected = await style(today)
      await other.click()
      assert.equal((await style(other)).background, selected.background)
      assert.ok((await style(today)).shadow.includes('rgb'))
      assert.equal(await today.getAttribute('aria-pressed'), 'false')
      if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, `calendar-${theme}-${width}.png`) })
      await today.click()
      assert.equal((await style(today)).background, selected.background)
      assert.equal(await page.getByText('토', { exact: true }).evaluate((node) => getComputedStyle(node).color), theme === 'light' ? 'rgb(37, 99, 235)' : 'rgb(96, 165, 250)')
      const saturdayNumber = page.getByRole('button', { name: '10월 24일', exact: true }).locator('span').first()
      const sundayNumber = page.getByRole('button', { name: '10월 25일', exact: true }).locator('span').first()
      assert.equal(await saturdayNumber.evaluate((node) => getComputedStyle(node).color), await sundayNumber.evaluate((node) => getComputedStyle(node).color))
      if (theme === 'dark') assert.equal(await saturdayNumber.evaluate((node) => getComputedStyle(node).color), 'rgb(252, 251, 247)')
      assert.equal(await page.getByRole('button', { name: '오늘', exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: '공유하기' }).count(), 0)
    } finally { await page.close() }
  })
}
test('중첩 시트를 닫으면 부모와 스크롤 잠금을 유지하고 마지막 닫기 후 포커스를 복구한다', async () => {
  const page = await screen('dark', 390)
  try {
    const opener = page.getByRole('button', { name: '공통 열기' })
    await opener.click()
    await page.getByRole('button', { name: '중첩 열기' }).click()
    const nested = page.getByRole('dialog', { name: '중첩 시트' })
    await nested.waitFor()
    await page.keyboard.press('Escape')
    await nested.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await opener.evaluate((node) => document.activeElement === node), true)
  } finally { await page.close() }
})

test('터치 확장·키보드 접기·Tab 순환·배경 닫기를 지원한다', async () => {
  const page = await screen('light', 390)
  try {
    await page.getByRole('button', { name: '공통 열기' }).click()
    const handle = page.getByRole('button', { name: '시트 확장' })
    const box = await handle.boundingBox()
    const session = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 80 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const collapse = page.getByRole('button', { name: '시트 접기' })
    await collapse.waitFor()
    if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'sheet-expanded.png') })
    await collapse.focus()
    await page.keyboard.press('Enter')
    await handle.waitFor()
    await handle.focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.getByRole('button', { name: '중첩 열기' }).evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await handle.evaluate((node) => node === document.activeElement), true)
    await page.mouse.click(10, 20)
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  } finally { await page.close() }
})

// 실제 스페이스 캘린더를 렌더링해 공통 그리드 연결과 월 이동·일정 점 표시를 함께 검증한다.
for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
  test(`${theme} ${width}px: 스페이스 캘린더도 토요일 파란색과 오늘 테두리를 유지한다`, async () => {
    const page = await screen(theme, width)
    try {
      await page.clock.setFixedTime(new Date(2026, 9, 20, 12))
      await page.evaluate(() => {
        window.fetch = async (url) => {
          if (!String(url).includes('/api/creators/13/calendar/schedules')) throw new Error('예상하지 않은 API 요청')
          return new Response(JSON.stringify({ code: 'SUCCESS', data: [{
            scheduleId: 101, title: '캘린더 회귀 일정', scheduleType: 'BROADCAST',
            startAt: new Date(2026, 9, 21, 12).toISOString(), endAt: new Date(2026, 9, 21, 13).toISOString(),
          }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        window.renderCreatorCalendar(true)
      })
      const today = page.getByRole('button', { name: '10월 20일', exact: true })
      const tomorrow = page.getByRole('button', { name: '10월 21일, 일정 1개', exact: true })
      await tomorrow.waitFor()
      assert.equal(await today.getAttribute('aria-current'), 'date')
      const selectedColor = await today.locator('span').first().evaluate((node) => getComputedStyle(node).backgroundColor)
      await tomorrow.click()
      assert.equal(await tomorrow.getAttribute('aria-pressed'), 'true')
      assert.equal(await tomorrow.locator('span').first().evaluate((node) => getComputedStyle(node).backgroundColor), selectedColor)
      const ring = await today.locator('span').first().evaluate((node) => ({ shadow: getComputedStyle(node).boxShadow, background: getComputedStyle(node).backgroundColor }))
      assert.ok(ring.shadow.includes(selectedColor))
      assert.equal(ring.background, 'rgba(0, 0, 0, 0)')
      assert.equal(await page.getByText('토', { exact: true }).evaluate((node) => getComputedStyle(node).color), theme === 'light' ? 'rgb(37, 99, 235)' : 'rgb(96, 165, 250)')
      const saturdayNumber = page.getByRole('button', { name: '10월 24일', exact: true }).locator('span').first()
      const sundayNumber = page.getByRole('button', { name: '10월 25일', exact: true }).locator('span').first()
      assert.equal(await saturdayNumber.evaluate((node) => getComputedStyle(node).color), await sundayNumber.evaluate((node) => getComputedStyle(node).color))
      if (theme === 'dark') assert.equal(await saturdayNumber.evaluate((node) => getComputedStyle(node).color), 'rgb(252, 251, 247)')
      assert.equal(await tomorrow.locator(':scope > span').last().locator('span').count(), 1)
      await page.getByText('캘린더 회귀 일정', { exact: true }).waitFor()
      if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, `creator-calendar-${theme}-${width}.png`) })
      await today.click()
      assert.equal(await today.locator('span').first().evaluate((node) => getComputedStyle(node).backgroundColor), selectedColor)
      await page.getByRole('button', { name: '다음 달' }).click()
      assert.equal(await page.locator('[aria-current="date"]').count(), 0)
      await page.getByRole('button', { name: '이전 달' }).click()
      assert.equal(await today.getAttribute('aria-pressed'), 'true')
    } finally { await page.close() }
  })
}
