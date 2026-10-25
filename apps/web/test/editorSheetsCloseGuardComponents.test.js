import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 게시글·일정 작성 시트: 작성한 내용이 없으면 바로 닫히고, 있으면 확인 시트(ConfirmSheet)를 거쳐 닫는다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/editorSheetsBrowser.jsx', import.meta.url)), name: 'EditorSheets', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const CONFIRM_TITLE = '작성 중인 내용이 사라져요'

async function screen(kind) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  // 브라우저 기본 확인창이 떠도 자동 취소되는 환경을 흉내 낸다. 시트를 쓰면 이 값은 호출되지 않는다.
  await page.addInitScript(() => { window.nativeConfirmCalls = 0; window.confirm = () => { window.nativeConfirmCalls += 1; return false } })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/editor-sheets')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((value) => window.renderEditor(value), kind)
  return page
}
const closeButton = (page) => page.getByRole('button', { name: '닫기', exact: true })

for (const [kind, sheetName, field] of [['post', '게시글 작성', '내용'], ['schedule', '일정 등록', '제목']]) {
  test(`${sheetName}: 작성한 내용이 없으면 확인 없이 바로 닫힌다`, async () => {
    const page = await screen(kind)
    try {
      await page.getByRole('dialog', { name: sheetName }).waitFor()
      await closeButton(page).first().click()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 1)
    } finally { await page.close() }
  })

  test(`${sheetName}: 작성 중에 닫으면 확인 시트가 열리고, 취소하면 그대로 남고, 확인하면 닫힌다`, async () => {
    const page = await screen(kind)
    try {
      const editor = page.getByRole('dialog', { name: sheetName })
      await editor.waitFor()
      await editor.locator(field === '내용' ? 'textarea' : 'input[type="text"]').first().fill('작성 중인 글')
      await closeButton(page).first().click()
      const confirm = page.getByRole('dialog', { name: CONFIRM_TITLE })
      await confirm.waitFor()
      await confirm.getByRole('button', { name: '취소' }).click()
      await confirm.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 0)
      await editor.waitFor()
      await closeButton(page).first().click()
      await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '버리고 닫기', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.closeCount), 1)
      assert.equal(await page.evaluate(() => window.nativeConfirmCalls), 0)
    } finally { await page.close() }
  })
}

// 뒤로가기는 닫기 버튼과 같은 가드를 거쳐야 한다. 시트가 열려 있는 동안 쌓은 history 항목이 뒤로가기를 받는다.
const sheetEntryReady = (page) => page.waitForFunction(() => window.history.state?.sheet !== undefined)
// 겹친 시트는 항목을 한 틱 늦게 쌓으므로, 현재 항목이 `previous`와 달라지길(새 시트의 항목이 쌓이길) 기다린다.
const sheetEntryChanged = (page, previous) => page.waitForFunction((id) => window.history.state?.sheet !== id, previous)
const sheetEntryGone = (page) => page.waitForFunction(() => window.history.state?.sheet === undefined)

test('게시글 작성: 내용이 없으면 뒤로가기로 바로 닫히고 쌓은 history 항목도 정리된다', async () => {
  const page = await screen('post')
  try {
    await page.getByRole('dialog', { name: '게시글 작성' }).waitFor()
    await sheetEntryReady(page)
    await page.goBack()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
    await sheetEntryGone(page)
  } finally { await page.close() }
})

test('게시글 작성: 작성 중 뒤로가기는 확인 시트를 열고, 취소하면 남고, 다시 뒤로가기해 확인하면 닫힌다', async () => {
  const page = await screen('post')
  try {
    const editor = page.getByRole('dialog', { name: '게시글 작성' })
    await editor.waitFor()
    await editor.locator('textarea').first().fill('작성 중인 글')
    await sheetEntryReady(page)
    const editorEntry = await page.evaluate(() => window.history.state.sheet)
    await page.goBack()
    const confirm = page.getByRole('dialog', { name: CONFIRM_TITLE })
    await confirm.waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
    // 확인 시트가 떠 있을 때의 뒤로가기는 확인 시트만 닫고 작성 시트는 남긴다.
    await sheetEntryChanged(page, editorEntry)
    await page.goBack()
    await confirm.waitFor({ state: 'detached' })
    await editor.waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
    // 작성 시트의 항목이 남아 있어 다시 뒤로가기해도 같은 확인을 받는다.
    await page.waitForFunction(() => window.history.state?.sheet !== undefined)
    await page.goBack()
    await confirm.waitFor()
    await confirm.getByRole('button', { name: '버리고 닫기', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
    await sheetEntryGone(page)
  } finally { await page.close() }
})

test('일정 등록: 작성 중 뒤로가기도 확인 시트를 거친다', async () => {
  const page = await screen('schedule')
  try {
    const editor = page.getByRole('dialog', { name: '일정 등록' })
    await editor.waitFor()
    await editor.locator('input[type="text"]').first().fill('작성 중인 일정')
    await sheetEntryReady(page)
    await page.goBack()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
  } finally { await page.close() }
})

test('일정 등록: 날짜가 2000~2099년 밖(다섯 자리 연도)이면 범위를 안내하고 저장할 수 없다', async () => {
  const page = await screen('schedule')
  try {
    const editor = page.getByRole('dialog', { name: '일정 등록' })
    await editor.waitFor()
    await editor.locator('input[type="text"]').first().fill('먼 미래 일정')
    const inputs = editor.locator('input[type="datetime-local"]')
    await inputs.nth(0).fill('2026-10-10T10:00')
    // 브라우저 날짜 입력은 10000년 같은 다섯 자리 연도를 값으로 받는다. React 입력처럼 값을 바꿔 그 상황을 만든다.
    await inputs.nth(1).evaluate((element) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '10000-12-25T01:01')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await editor.getByText('날짜는 2000년부터 2099년 사이로 입력해주세요.').waitFor()
    assert.equal(await editor.getByRole('button', { name: '일정 등록', exact: true }).isDisabled(), true)
    await inputs.nth(1).fill('2026-10-10T12:00')
    assert.equal(await editor.getByText('날짜는 2000년부터 2099년 사이로 입력해주세요.').count(), 0)
    assert.equal(await editor.getByRole('button', { name: '일정 등록', exact: true }).isDisabled(), false)
  } finally { await page.close() }
})
