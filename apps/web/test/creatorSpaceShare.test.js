import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorSpaceShareBrowser.jsx', import.meta.url)), name: 'CreatorSpaceShareTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const SHARE_BUTTON = 'button:not([aria-label])'
const MISSION = { missionId: 5, type: 'SHARE', rewardAmount: 1, completedToday: false }

/**
 * 외부 요청을 막은 빈 화면에 크리에이터 스페이스(크리에이터 11, slug test) 번들을 올리고 서버를 흉내 낸다.
 * - window.missions: 미션 목록 응답. window.shareReplies: 공유 보상 응답을 순서대로 쓰고, 비면 신규 적립(202)으로 답한다.
 * - window.mySpaces: 내 Space 조회 응답을 순서대로 쓴다. 항목에 hold가 있으면 window.releaseMySpace()를 부를 때까지 응답을 늦춘다.
 * - window.shareCalls: 보상 API 호출 본문 기록.
 */
async function screen({ missions = [{ ...MISSION }], mySpaces = [] } = {}) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/space-test')
  await page.evaluate(({ initialMissions, initialMySpaces }) => {
    window.missions = initialMissions
    window.mySpaces = initialMySpaces
    window.shareReplies = []
    window.shareCalls = []
    window.missionReads = 0
    window.toasts = []
    window.ticketRefreshes = 0
    const envelope = (status, code, data, message = null) => new Response(JSON.stringify({ code, data, message }), { status })
    window.fetch = (url, options) => {
      const path = new URL(String(url), location.href).pathname
      if (path === '/api/creator-spaces/test') {
        return Promise.resolve(envelope(200, 'SUCCESS', { creatorId: 11, creatorName: '테스트 크리에이터', slug: 'test', introText: '', profileImageUrl: null, bannerImageUrl: null, followerCount: 3 }))
      }
      if (path === '/api/creators/11/tickets') return Promise.resolve(envelope(200, 'SUCCESS', { creatorId: 11, balance: 0 }))
      if (path === '/api/creators/11/missions' && options.method === 'GET') {
        window.missionReads += 1
        return Promise.resolve(envelope(200, 'SUCCESS', window.missions))
      }
      if (path === '/api/creators/11/missions/share/complete') {
        window.shareCalls.push(JSON.parse(options.body))
        const reply = window.shareReplies.shift() ?? { status: 202, code: 'EARN_ACCEPTED', data: { rewardAmount: 1 } }
        return Promise.resolve(envelope(reply.status, reply.code, reply.data ?? null, '응답'))
      }
      if (path === '/api/creator/space') {
        const next = window.mySpaces.shift()
        const body = { creatorId: 99, creatorName: '내 스페이스', slug: 'mine', introText: '', profileImageUrl: null, bannerImageUrl: null, slugChangeableAt: null }
        // hold가 있는 항목은 window.releaseMySpace()를 부를 때까지 응답을 보류한다(조회가 끝나기 전 상태를 만들기 위해).
        const space = next?.hold
          ? new Promise((resolve) => { window.releaseMySpace = () => resolve({ creatorId: next.creatorId }) })
          : Promise.resolve(next)
        return space.then((value) => envelope(200, 'SUCCESS', { ...body, ...(value ?? {}) }))
      }
      if (path === '/api/creators/11/youtube-channel') return Promise.resolve(envelope(404, 'CREATOR_CHANNEL_NOT_CONFIGURED', null, '채널 없음'))
      if (path.includes('/calendar/schedules')) return Promise.resolve(envelope(200, 'SUCCESS', []))
      return Promise.resolve(envelope(200, 'SUCCESS', { items: [], page: 0, hasNext: false, totalElements: 0 }))
    }
  }, { initialMissions: missions, initialMySpaces: mySpaces })
  await page.addScriptTag({ content: bundle })
  return { page, errors }
}

/** 공유 방식을 정한다: 'sheet'는 공유 시트 완료, 'cancel'은 시트 닫기, 'copy'는 시트가 없어 링크 복사만 되는 환경이다. */
const useShareMode = (page, mode) => page.evaluate((shareMode) => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true })
  const share = {
    sheet: async () => {},
    cancel: async () => { throw new DOMException('닫음', 'AbortError') },
    copy: undefined,
  }[shareMode]
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
}, mode)

const shareCalls = (page) => page.evaluate(() => window.shareCalls)
const shareCard = (page) => page.locator(SHARE_BUTTON, { hasText: /공유하기|완료|다시 확인|처리 중/ })
const headerShare = (page) => page.locator('button[aria-label="공유하기"]')

test('공유 시트를 끝내면 보상 API를 한 번 호출하고 카드가 완료로 바뀌며 응모권이 갱신된다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1 }))
    await useShareMode(page, 'sheet')
    await page.getByText('공유 미션').waitFor()
    await headerShare(page).click()
    await page.getByText('완료', { exact: true }).waitFor()

    const calls = await shareCalls(page)
    assert.equal(calls.length, 1)
    assert.deepEqual(Object.keys(calls[0]), ['requestId'])
    assert.equal(await page.evaluate(() => window.ticketRefreshes), 1)
    assert.ok((await page.evaluate(() => window.toasts)).some((message) => message.includes('공유 미션 완료')))
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('공유 시트를 닫으면 보상 API를 호출하지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1 }))
    await useShareMode(page, 'cancel')
    await page.getByText('공유 미션').waitFor()
    await headerShare(page).click()
    await page.waitForTimeout(300)
    assert.equal((await shareCalls(page)).length, 0)
    assert.equal(await shareCard(page).innerText(), '공유하기')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('공유 시트가 없는 환경에서 링크를 복사하면 보상 API를 호출한다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1 }))
    await useShareMode(page, 'copy')
    await page.getByText('공유 미션').waitFor()
    await shareCard(page).click()
    await page.getByText('완료', { exact: true }).waitFor()
    assert.equal((await shareCalls(page)).length, 1)
    assert.ok((await page.evaluate(() => window.toasts)).includes('공유 링크를 복사했어요.'))
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('이미 받은 미션과 비로그인에서는 보상 API를 호출하지 않는다', async () => {
  const done = await screen({ missions: [{ ...MISSION, completedToday: true }] })
  try {
    await done.page.evaluate(() => window.renderSpace({ memberId: 1 }))
    await useShareMode(done.page, 'sheet')
    await done.page.getByText('공유 미션').waitFor()
    assert.equal(await shareCard(done.page).isDisabled(), true)
    await headerShare(done.page).click()
    await done.page.waitForTimeout(300)
    assert.equal((await shareCalls(done.page)).length, 0)
    assert.deepEqual(done.errors, [])
  } finally { await done.page.close() }

  const anonymous = await screen()
  try {
    await anonymous.page.evaluate(() => window.renderSpace({ authenticated: false }))
    await useShareMode(anonymous.page, 'sheet')
    await headerShare(anonymous.page).waitFor()
    await headerShare(anonymous.page).click()
    await anonymous.page.waitForTimeout(300)
    assert.equal(await anonymous.page.getByText('공유 미션').count(), 0)
    assert.equal((await shareCalls(anonymous.page)).length, 0)
    assert.deepEqual(anonymous.errors, [])
  } finally { await anonymous.page.close() }
})

test('본인 스페이스에서는 SHARE 카드가 보이지 않고 공유해도 보상 API를 호출하지 않는다', async () => {
  const { page, errors } = await screen({ mySpaces: [{ creatorId: 11 }] })
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1, isCreator: true }))
    await useShareMode(page, 'sheet')
    await page.getByRole('button', { name: '스페이스 편집' }).waitFor()
    assert.equal(await page.getByText('공유 미션').count(), 0)
    await headerShare(page).click()
    await page.waitForTimeout(300)
    assert.equal((await shareCalls(page)).length, 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('크리에이터 계정이 바뀌면 새 계정의 본인 여부가 확인될 때까지 보상 API를 호출하지 않는다', async () => {
  // 첫 계정의 스페이스는 99번(이 스페이스가 아님), 둘째 계정의 스페이스는 11번(이 스페이스)이고 응답이 늦게 온다.
  const { page, errors } = await screen({ mySpaces: [{ creatorId: 99 }, { creatorId: 11, hold: true }] })
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1, isCreator: true }))
    await useShareMode(page, 'sheet')
    await page.getByText('공유 미션').waitFor()

    await page.evaluate(() => window.renderSpace({ memberId: 2, isCreator: true }))
    await page.waitForFunction(() => typeof window.releaseMySpace === 'function')
    // 새 계정의 조회가 끝나기 전에는 이전 계정의 Space 정보를 쓰지 않으므로 본인 여부를 모르는 상태다.
    assert.equal(await page.getByText('공유 미션').count(), 0)
    await headerShare(page).click()
    await page.waitForTimeout(300)
    assert.equal((await shareCalls(page)).length, 0)

    await page.evaluate(() => window.releaseMySpace())
    await page.getByRole('button', { name: '스페이스 편집' }).waitFor()
    assert.equal(await page.getByText('공유 미션').count(), 0)
    assert.equal((await shareCalls(page)).length, 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('DUPLICATE_MISSION을 받아도 서버가 완료로 기록하기 전에는 완료로 바꾸지 않고, 확인되면 완료로 바꾼다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => {
      window.shareReplies.push({ status: 409, code: 'DUPLICATE_MISSION' })
      window.renderSpace({ memberId: 1 })
    })
    await useShareMode(page, 'sheet')
    await page.getByText('공유 미션').waitFor()
    await headerShare(page).click()

    // 짧은 간격으로 몇 번 확인해도 서버가 미완료로 알리면 "다시 확인" 상태로 남는다.
    await page.getByRole('button', { name: '다시 확인' }).waitFor({ timeout: 15000 })
    assert.equal(await page.getByText('완료', { exact: true }).count(), 0)
    assert.equal((await shareCalls(page)).length, 1)

    // 서버가 완료로 기록한 뒤 다시 확인하면 완료로 바뀌고 응모권이 갱신된다.
    await page.evaluate(() => { window.missions[0].completedToday = true })
    await page.getByRole('button', { name: '다시 확인' }).click()
    await page.getByText('완료', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.ticketRefreshes), 1)
    assert.equal((await shareCalls(page)).length, 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('공유 보상 안내는 일일 초기화가 아니라 좋아요 미션에만 적용한다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderSpace({ memberId: 1 }))
    await page.getByText('공유 미션').waitFor()
    const text = await page.evaluate(() => document.body.innerText)
    assert.ok(text.includes('좋아요 미션은 매일 00:00 갱신'))
    assert.ok(text.includes('한 번만 받을 수 있어요'))
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
