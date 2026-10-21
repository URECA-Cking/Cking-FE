import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 스페이스 편집 시트: 저장하지 않은 변경(소개·공유 주소)이 있으면 닫을 때 확인 시트를 거치고, 없거나 저장했으면 바로 닫힌다(#355).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://space.test') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/spaceEditCloseBrowser.jsx', import.meta.url)), name: 'SpaceEditClose', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const base = { creatorId: 1, slug: 'creator-1', introText: '기존 소개', profileImageUrl: 'https://images.test/profile.png', bannerImageUrl: 'https://images.test/banner.png' }
const CONFIRM_TITLE = '작성 중인 내용이 사라져요'

async function screen({ closeOnBack = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/space-edit-close')
  await page.addStyleTag({ content: css })
  await page.evaluate(([record, backGuard]) => {
    window.closeOnBack = backGuard
    window.spaceRecord = { ...record }
    window.toasts = []
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const method = options.method ?? 'GET'
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creator/profile') return reply(null)
      if (path === '/api/creator/space') {
        if (method === 'PATCH') window.spaceRecord = { ...window.spaceRecord, introText: JSON.parse(options.body).introText }
        return reply({ ...window.spaceRecord })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, [base, closeOnBack])
  await page.addScriptTag({ content: bundle })
  await page.getByRole('dialog', { name: '스페이스 편집' }).waitFor()
  return page
}
const closeButton = (page) => page.getByRole('button', { name: '닫기', exact: true }).first()
const intro = (page) => page.getByRole('dialog', { name: '스페이스 편집' }).locator('textarea')

test('변경이 없으면 확인 없이 바로 닫힌다', async () => {
  const page = await screen()
  try {
    await closeButton(page).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
  } finally { await page.close() }
})

test('소개를 고치고 저장하지 않고 닫으면 확인 시트가 열리고, 취소하면 남고, 확인하면 닫힌다', async () => {
  const page = await screen()
  try {
    await intro(page).fill('고친 소개')
    await closeButton(page).click()
    const confirm = page.getByRole('dialog', { name: CONFIRM_TITLE })
    await confirm.waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
    await confirm.getByRole('button', { name: '취소' }).click()
    await confirm.waitFor({ state: 'detached' })
    assert.equal(await intro(page).inputValue(), '고친 소개')
    await closeButton(page).click()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '버리고 닫기', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
  } finally { await page.close() }
})

test('소개를 고치고 저장한 뒤에는 확인 없이 바로 닫힌다', async () => {
  const page = await screen()
  try {
    await intro(page).fill('저장한 소개')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    await closeButton(page).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
  } finally { await page.close() }
})

test('공유 주소를 고치고 바꾸지 않은 채 닫아도 확인 시트가 열린다', async () => {
  const page = await screen()
  try {
    await page.getByPlaceholder('iu-official').fill('new-address')
    await closeButton(page).click()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
  } finally { await page.close() }
})

test('소개 앞뒤에 공백을 넣어 저장하면 저장 뒤에는 확인 없이 바로 닫힌다', async () => {
  const page = await screen()
  try {
    await intro(page).fill('  공백 있는 소개  ')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    await closeButton(page).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
  } finally { await page.close() }
})

test('소개에 공백만 더한 채로는 변경으로 보지 않는다', async () => {
  const page = await screen()
  try {
    await intro(page).fill('기존 소개   ')
    await closeButton(page).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.closeCount), 1)
  } finally { await page.close() }
})

// 뒤로가기는 부모가 closeOnBack을 켠 경우(내 스페이스의 "스페이스 편집" 버튼으로 연 경우)에만 같은 가드를 거친다.
test('closeOnBack이 켜져 있으면 뒤로가기도 확인 시트를 거친다', async () => {
  const page = await screen({ closeOnBack: true })
  try {
    await intro(page).fill('고친 소개')
    await page.waitForFunction(() => window.history.state?.sheet !== undefined)
    await page.goBack()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '취소' }).click()
    assert.equal(await intro(page).inputValue(), '고친 소개')
  } finally { await page.close() }
})

test('변경이 없으면 뒤로가기로 바로 닫히고, closeOnBack이 꺼져 있으면 history 항목을 쌓지 않는다', async () => {
  const on = await screen({ closeOnBack: true })
  try {
    await on.waitForFunction(() => window.history.state?.sheet !== undefined)
    await on.goBack()
    await on.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await on.evaluate(() => window.closeCount), 1)
  } finally { await on.close() }
  const off = await screen()
  try {
    await off.waitForTimeout(100)
    assert.equal(await off.evaluate(() => window.history.state?.sheet), undefined)
  } finally { await off.close() }
})
