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

async function screen({ via = '스페이스 편집으로 이동' } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/my')
  await page.addStyleTag({ content: css })
  await page.evaluate(() => {
    const envelope = (data, status = 200, code = 'SUCCESS') => new Response(JSON.stringify({ code, data, message: null }), { status })
    // 공유 주소(slug)를 바꾸면 이전 주소는 더 이상 열리지 않는다(404).
    window.slug = 'test'
    const record = () => ({ creatorId: 11, creatorName: '테스트 크리에이터', slug: window.slug, introText: '기존 소개', profileImageUrl: 'https://images.test/p.png', bannerImageUrl: 'https://images.test/b.png', slugChangeableAt: null })
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      if (path.startsWith('/api/creator-spaces/')) {
        return path.endsWith(`/${window.slug}`) ? envelope({ ...record(), followerCount: 3 }) : envelope(null, 404, 'CREATOR_SPACE_NOT_FOUND')
      }
      if (path === '/api/creator/space/slug') {
        window.slug = JSON.parse(options.body).slug
        return envelope(record())
      }
      if (path === '/api/creator/space') return envelope(record())
      if (path === '/api/creator/profile') return envelope(null)
      if (path === '/api/creators/11/tickets') return envelope({ creatorId: 11, balance: 0 })
      if (path.includes('/missions')) return envelope([])
      if (path.includes('/calendar/schedules')) return envelope([])
      if (path === '/api/creators/11/youtube-channel') return envelope(null, 409, 'CREATOR_CHANNEL_NOT_CONFIGURED')
      return envelope({ items: [], page: 0, hasNext: false, totalElements: 0 })
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: via, exact: true }).click()
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
    assert.equal(await path(page), '/test')
    await confirm.getByRole('button', { name: '취소' }).click()
    await confirm.waitFor({ state: 'detached' })
    assert.equal(await intro(page).inputValue(), '고친 소개')
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '버리고 닫기', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForTimeout(400)
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await path(page), '/test')
  } finally { await page.close() }
})

test('변경이 없으면 뒤로가기로 시트만 닫히고, 한 번 더 뒤로가면 마이페이지로 돌아간다(남는 history 항목이 없다)', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await page.goBack()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.history.state?.sheet === undefined)
    assert.equal(await path(page), '/test')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
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
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})

// 시트에서 공유 주소를 바꾼 뒤 닫고 뒤로가기를 눌러도, 더는 열리지 않는 이전 주소가 아니라 마이페이지로 돌아간다.
async function changeSlug(page, next) {
  await page.getByPlaceholder('iu-official').fill(next)
  // 저장 버튼은 하나이고, 공유 주소 변경은 14일 확인 시트를 거친다(#401).
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByRole('dialog', { name: '변경 내용을 저장할까요?' }).getByRole('button', { name: '저장하기', exact: true }).click()
  await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
  await page.waitForFunction((slug) => window.slug === slug, next)
}

test('공유 주소를 바꾸고 시트를 닫으면 새 주소로 옮기고, 뒤로가기는 마이페이지로 돌아간다', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await changeSlug(page, 'changed')
    // 시트가 열려 있는 동안에는 주소를 옮기지 않는다.
    assert.equal(await path(page), '/test')
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => location.pathname === '/changed')
    await page.getByRole('button', { name: '스페이스 편집' }).first().waitFor()
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})

test('공유 주소를 바꾼 뒤 뒤로가기로 시트를 닫아도 새 주소로 옮기고, 한 번 더 뒤로가면 마이페이지로 돌아간다', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await changeSlug(page, 'changed')
    await page.goBack()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => location.pathname === '/changed')
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})

test('test → changed로 바꿨다가 이전 주소 test로 되돌리고 닫으면, 예약해 둔 changed로 옮기지 않는다', async () => {
  const page = await screen()
  try {
    await entryReady(page)
    await changeSlug(page, 'changed')
    // 되돌리기는 입력칸만 채우고 저장 버튼으로 저장한다. 이전 값으로 되돌리는 것이라 14일 확인 시트는 뜨지 않는다.
    await page.getByRole('button', { name: /이전 주소 .*test.*로 되돌리기/ }).click()
    assert.equal(await page.getByPlaceholder('iu-official').inputValue(), 'test')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.slug === 'test')
    assert.equal(await page.getByRole('dialog', { name: '변경 내용을 저장할까요?' }).count(), 0)
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForTimeout(900)
    assert.equal(await path(page), '/test')
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})

test('/space/{slug} 경로로 들어와 주소를 바꾸고 닫아도 새 주소로 옮기고, 뒤로가기는 마이페이지로 돌아간다', async () => {
  const page = await screen({ via: '스페이스 편집으로 이동(space 경로)' })
  try {
    await entryReady(page)
    assert.equal(await path(page), '/space/test')
    await changeSlug(page, 'changed')
    await page.getByRole('button', { name: '닫기', exact: true }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => location.pathname === '/changed')
    await page.goBack()
    await page.getByRole('button', { name: '스페이스 편집으로 이동', exact: true }).waitFor()
    assert.equal(await path(page), '/my')
  } finally { await page.close() }
})
