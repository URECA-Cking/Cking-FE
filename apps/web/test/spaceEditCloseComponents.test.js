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
const LOCK_CONFIRM_TITLE = '변경 내용을 저장할까요?'

async function screen({ closeOnBack = false, profile = null, space = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/space-edit-close')
  await page.addStyleTag({ content: css })
  await page.evaluate(([record, backGuard, profileRecord]) => {
    window.closeOnBack = backGuard
    window.spaceRecord = { ...record }
    window.profileRecord = profileRecord
    window.profilePuts = []
    window.toasts = []
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const method = options.method ?? 'GET'
      const reply = (data) => new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
      if (path === '/api/creator/profile') {
        if (method === 'PUT') {
          const { activityName } = JSON.parse(options.body)
          window.profilePuts.push(activityName)
          window.profileRecord = { ...window.profileRecord, activityName, activityNameConfigured: true, activityNameChangeableAt: '2099-01-01T00:00:00Z' }
        }
        return reply(window.profileRecord)
      }
      if (path === '/api/creator/space/slug') {
        if (window.holdSlug) await window.holdSlug
        window.spaceRecord = { ...window.spaceRecord, slug: JSON.parse(options.body).slug }
        return reply({ ...window.spaceRecord, slugChangeableAt: null })
      }
      if (path === '/api/creator/space') {
        if (method === 'PATCH') {
          if (window.failPatch) return new Response(JSON.stringify({ code: 'SYSTEM_ERROR', data: null, message: '서버 오류' }), { status: 500 })
          if (window.holdPatch) await window.holdPatch
          window.spaceRecord = { ...window.spaceRecord, introText: JSON.parse(options.body).introText }
        }
        return reply({ ...window.spaceRecord })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, [{ ...base, ...space }, closeOnBack, profile])
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

test('저장 응답을 기다리는 동안 소개를 더 고치면 응답이 그 입력을 덮어쓰지 않고, 닫을 때 확인을 거친다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.holdPatch = new Promise((resolve) => { window.releasePatch = resolve }) })
    await intro(page).fill('소개 A')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.toasts.length === 0 && [...document.querySelectorAll('button')].some((button) => button.textContent === '저장하는 중...'))
    await intro(page).fill('소개 B')
    await page.evaluate(() => window.releasePatch())
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    assert.equal(await intro(page).inputValue(), '소개 B')
    await closeButton(page).click()
    await page.getByRole('dialog', { name: CONFIRM_TITLE }).waitFor()
    assert.equal(await page.evaluate(() => window.closeCount), 0)
  } finally { await page.close() }
})

// 저장 버튼은 시트 아래 하나다(#401). 바뀐 항목의 API만 부르고, 공유 주소처럼 14일 잠기는 변경은 확인 시트를 먼저 거친다.
test('소개만 바꾸면 확인 없이 소개만 저장하고 공유 주소 API는 부르지 않는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.slugCalls = 0; const original = window.fetch; window.fetch = (url, options) => { if (String(url).endsWith('/api/creator/space/slug')) window.slugCalls += 1; return original(url, options) } })
    assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isDisabled(), true)
    await intro(page).fill('소개만 바꿈')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    assert.equal(await page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE }).count(), 0)
    assert.equal(await page.evaluate(() => window.slugCalls), 0)
  } finally { await page.close() }
})

test('저장 버튼은 하나이고 시트 내용의 맨 끝(공유 주소 아래)에 있다', async () => {
  const page = await screen()
  try {
    const dialog = page.getByRole('dialog', { name: '스페이스 편집' })
    assert.equal(await dialog.getByRole('button', { name: /저장|바꾸기/ }).count(), 1)
    const save = await dialog.getByRole('button', { name: '저장', exact: true }).boundingBox()
    const slugInput = await page.getByPlaceholder('iu-official').boundingBox()
    assert.ok(save.y > slugInput.y + slugInput.height)
  } finally { await page.close() }
})

test('공유 주소를 바꾼 지 14일이 안 지났으면 주소 입력이 막혀 새 주소로 저장할 수 없다', async () => {
  const page = await screen({ space: { slugChangeableAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() } })
  try {
    assert.equal(await page.getByPlaceholder('iu-official').isDisabled(), true)
    await page.getByText(/일 후 새 주소로 바꿀 수 있어요/).waitFor()
    assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isDisabled(), true)
  } finally { await page.close() }
})

test('활동명도 14일이 안 지났으면 공유 주소와 같은 모양으로 남은 일수를 안내하고 입력을 막는다', async () => {
  const changeableAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const page = await screen({ profile: { activityName: '기존이름', activityNameConfigured: true, activityNameChangeableAt: changeableAt, restorableActivityName: null } })
  try {
    const name = page.getByLabel('스페이스와 이벤트에 보이는 크리에이터 이름')
    await name.waitFor()
    assert.equal(await name.isDisabled(), true)
    await page.getByText('3일 후 새 활동명으로 바꿀 수 있어요. (이전 활동명으로 되돌리기는 지금도 가능해요)').waitFor()
    assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isDisabled(), true)
  } finally { await page.close() }
})

test('공유 주소를 바꾸면 14일 확인 시트를 거치고, 취소하면 저장하지 않는다', async () => {
  const page = await screen()
  try {
    await page.getByPlaceholder('iu-official').fill('new-address')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    const confirm = page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE })
    await confirm.getByText('14일 동안 다시 바꿀 수 없고').waitFor()
    await confirm.getByRole('button', { name: '취소', exact: true }).click()
    await confirm.waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.spaceRecord.slug), 'creator-1')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE }).getByRole('button', { name: '저장하기', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    assert.equal(await page.evaluate(() => window.spaceRecord.slug), 'new-address')
  } finally { await page.close() }
})

test('소개와 공유 주소를 함께 바꿨는데 주소만 실패하면 소개는 저장되고 주소 칸에만 오류가 남는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { const original = window.fetch; window.fetch = async (url, options = {}) => String(url).endsWith('/api/creator/space/slug')
      ? new Response(JSON.stringify({ code: 'SLUG_ALREADY_TAKEN', data: null, message: 'taken' }), { status: 409 }) : original(url, options) })
    await intro(page).fill('함께 바꾼 소개')
    await page.getByPlaceholder('iu-official').fill('taken-address')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE }).getByRole('button', { name: '저장하기', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('일부 항목을 저장하지 못했어요. 표시된 내용을 확인해주세요.'))
    assert.equal(await page.evaluate(() => window.spaceRecord.introText), '함께 바꾼 소개')
    await page.getByRole('alert').filter({ hasText: '이미 사용 중이거나' }).waitFor()
    assert.equal(await page.getByPlaceholder('iu-official').inputValue(), 'taken-address')
  } finally { await page.close() }
})

test('활동명은 따로 저장 버튼 없이 시트 저장으로 저장하고, 이미 정한 활동명을 바꾸면 14일 확인을 거친다', async () => {
  for (const configured of [true, false]) {
    const page = await screen({ profile: { activityName: '기존이름', activityNameConfigured: configured, activityNameChangeableAt: null, restorableActivityName: null } })
    try {
      const name = page.getByLabel('스페이스와 이벤트에 보이는 크리에이터 이름')
      await name.waitFor()
      assert.equal(await page.getByRole('button', { name: /^활동명 (저장|설정)$/ }).count(), 0)
      await name.fill('새이름')
      // 활동명 변경도 저장하지 않은 변경이라 닫을 때 확인을 거친다.
      await closeButton(page).click()
      await page.getByRole('dialog', { name: CONFIRM_TITLE }).getByRole('button', { name: '취소' }).click()
      await page.getByRole('button', { name: '저장', exact: true }).click()
      // 처음 정하는 활동명은 14일 잠금이 없어 확인 없이 저장한다.
      if (configured) await page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE }).getByRole('button', { name: '저장하기', exact: true }).click()
      await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
      assert.deepEqual(await page.evaluate(() => window.profilePuts), ['새이름'])
    } finally { await page.close() }
  }
})

test('소개 저장이 실패한 뒤 소개를 고치면 실패 문구가 사라진다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.failPatch = true })
    await intro(page).fill('실패할 소개')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    const failure = page.getByRole('dialog', { name: '스페이스 편집' }).getByRole('alert')
    await failure.first().waitFor()
    await intro(page).fill('고친 소개')
    assert.equal(await failure.count(), 0)
  } finally { await page.close() }
})

// 저장하는 동안에는 공유 주소 칸을 막는다(잠금 기간 처리와 같은 입력 잠금). 응답이 오면 저장된 주소가 들어가고 바로 닫힌다.
test('공유 주소를 저장하는 동안에는 주소 칸이 막히고, 응답이 오면 저장된 주소로 남는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => { window.holdSlug = new Promise((resolve) => { window.releaseSlug = resolve }) })
    const slugInput = page.getByPlaceholder('iu-official')
    await slugInput.fill('address-a')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.getByRole('dialog', { name: LOCK_CONFIRM_TITLE }).getByRole('button', { name: '저장하기', exact: true }).click()
    await page.getByRole('button', { name: '저장하는 중...' }).waitFor()
    assert.equal(await slugInput.isDisabled(), true)
    await page.evaluate(() => window.releaseSlug())
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))
    assert.equal(await slugInput.inputValue(), 'address-a')
    assert.equal(await slugInput.isDisabled(), false)
    await closeButton(page).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  } finally { await page.close() }
})
