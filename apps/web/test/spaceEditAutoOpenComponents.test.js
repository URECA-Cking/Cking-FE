import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 마이페이지에서 openSpaceEdit 상태로 들어와 자동으로 열린 스페이스 편집 시트도 뒤로가기가 폐기 확인을 거친다(#369).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/spaceEditAutoOpenBrowser.jsx', import.meta.url)), name: 'SpaceEditAutoOpen', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const CONFIRM_TITLE = '작성 중인 내용이 사라져요'

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/my')
  await page.addStyleTag({ content: css })
  await page.evaluate(() => {
    const envelope = (data, status = 200, code = 'SUCCESS') => new Response(JSON.stringify({ code, data, message: null }), { status })
    const mine = { creatorId: 11, creatorName: '테스트 크리에이터', slug: 'test', introText: '기존 소개', profileImageUrl: 'https://images.test/p.png', bannerImageUrl: 'https://images.test/b.png', slugChangeableAt: null }
    window.fetch = async (url) => {
      const path = new URL(String(url), location.href).pathname
      if (path === '/api/creator-spaces/test') return envelope({ ...mine, followerCount: 3 })
      if (path === '/api/creator/space') return envelope(mine)
      if (path === '/api/creator/profile') return envelope(null)
      if (path === '/api/creators/11/tickets') return envelope({ creatorId: 11, balance: 0 })
      if (path.includes('/missions')) return envelope([])
      if (path.includes('/calendar/schedules')) return envelope([])
      if (path === '/api/creators/11/youtube-channel') return envelope(null, 409, 'CREATOR_CHANNEL_NOT_CONFIGURED')
      return envelope({ items: [], page: 0, hasNext: false, totalElements: 0 })
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '스페이스 편집으로 이동' }).click()
  await page.getByRole('dialog', { name: '스페이스 편집' }).waitFor()
  return page
}
const editor = (page) => page.getByRole('dialog', { name: '스페이스 편집' })
const intro = (page) => editor(page).locator('textarea')
const entryReady = (page) => page.waitForFunction(() => window.history.state?.sheet !== undefined)
const path = (page) => page.evaluate(() => location.pathname)

test('자동으로 열린 시트에서 소개를 고치고 뒤로가기를 누르면 확인 시트가 뜨고, 취소하면 유지되고, 버리면 다시 열리지 않는다', async () => {
  const page = await screen()
  try {
    // 열릴 때 요청을 한 번 쓰고 지운다: 이동 상태의 openSpaceEdit이 false가 된다.
    await entryReady(page)
    assert.equal(await page.evaluate(() => window.history.state.usr.openSpaceEdit), false)
    await intro(page).fill('고친 소개')
    await page.goBack()
    const confirm = page.getByRole('dialog', { name: CONFIRM_TITLE })
    await confirm.waitFor()
    assert.equal(await path(page), '/space/test')
    await confirm.getByRole('button', { name: '취소' }).click()
    await confirm.waitFor({ state: 'detached' })
    assert.equal(await intro(page).inputValue(), '고친 소개')
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '버리고 닫기', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForTimeout(400)
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await path(page), '/space/test')
  } finally { await page.close() }
})

test('변경이 없으면 뒤로가기로 시트만 닫히고, 한 번 더 뒤로가면 마이페이지로 돌아간다(남는 history 항목이 없다)', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await page.goBack()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.history.state?.sheet === undefined)
    assert.equal(await path(page), '/space/test')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동' }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})

test('닫기 버튼으로 닫아도 남는 history 항목 없이 한 번 뒤로가면 마이페이지로 돌아간다', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.history.state?.sheet === undefined)
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동' }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})
