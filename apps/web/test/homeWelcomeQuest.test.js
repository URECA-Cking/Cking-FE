import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

/** 웰컴 퀘스트 상태를 만든다. 단계별 상태와 보너스 상태, 대상 여부를 바꿔 끼울 수 있다. */
function quest({ SIGNUP = 'CLAIMABLE', FOLLOW = 'NOT_MET', QUIZ = 'CLAIMABLE', BONUS = 'CLAIMABLE', eligible = true } = {}) {
  if (!eligible) return { eligible: false, completed: false, items: [], bonus: null }
  const items = [
    { step: 'SIGNUP', rewardAmount: 1, status: SIGNUP },
    { step: 'FOLLOW', rewardAmount: 1, status: FOLLOW },
    { step: 'QUIZ', rewardAmount: 1, status: QUIZ },
  ]
  return {
    eligible: true,
    completed: items.every((item) => item.status === 'CLAIMED'),
    items,
    bonus: { step: 'BONUS', rewardAmount: 1, status: BONUS },
  }
}

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/homeScreenBrowser.jsx', import.meta.url)), name: 'HomeScreenTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/**
 * 외부 요청을 막은 빈 화면에 홈 번들을 올리고 서버를 흉내 낸다.
 * - 웰컴 퀘스트 상태는 window.quest이고, 지급(POST)은 서버처럼 조건을 판정해 window.quest를 바꾼다.
 * - 팔로우 조건은 window.following이 정하고, 틀이 한 팔로우 호출은 window.followCalls에 남는다.
 * - 나머지 홈 데이터(이벤트·크리에이터·당첨)는 빈 목록이다.
 */
async function screen(initialQuest) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await boot(page, initialQuest)
  return { page, errors }
}

/**
 * 페이지를 처음부터 다시 열고 서버 흉내와 번들을 올린다. 새로고침을 흉내 낼 때도 쓴다.
 * 메모리 상태는 사라지고 같은 출처의 localStorage는 남는다.
 */
async function boot(page, initialQuest) {
  await page.goto('http://localhost/home-test')
  await page.evaluate((state) => {
    window.quest = state
    window.following = false
    window.followCalls = []
    window.toasts = []
    window.ticketRefreshes = 0
    window.requests = []
    window.scrolled = 0
    window.failClaims = 0
    window.questFailures = 0
    Element.prototype.scrollIntoView = () => { window.scrolled += 1 }
    const envelope = (status, code, data, message = null) => new Response(JSON.stringify({ code, data, message }), { status })
    const recommendations = {
      policyVersion: 'POPULAR_FALLBACK_V1',
      recommendationRequestId: 'rec-1',
      items: [11, 12].map((id) => ({ creatorId: id, creatorName: `크리에이터${id}`, profileImageUrl: null, introText: '', interestCodes: [], seedCreatorIds: [] })),
    }
    window.fetch = (url, options) => {
      const path = new URL(String(url), location.href).pathname
      const body = options.body ? JSON.parse(options.body) : null
      window.requests.push({ path, method: options.method, body })
      if (path === '/api/me/welcome-quest') {
        // questFailures가 남아 있으면 상태 조회를 서버 오류로 실패시킨다.
        if (window.questFailures > 0) { window.questFailures -= 1; return Promise.resolve(envelope(500, 'INTERNAL_SERVER_ERROR', null, '조회 실패')) }
        return Promise.resolve(envelope(200, 'SUCCESS', window.quest))
      }
      const claim = path.match(/^\/api\/me\/welcome-quest\/(\w+)\/claim$/)
      if (claim) {
        const step = claim[1]
        // failClaims가 남아 있으면 서버 오류로 한 번 실패시킨다.
        if (window.failClaims > 0) { window.failClaims -= 1; return Promise.resolve(envelope(500, 'INTERNAL_SERVER_ERROR', null, '서버 오류')) }
        if (step === 'QUIZ' && body.answer !== true) return Promise.resolve(envelope(409, 'WELCOME_QUEST_WRONG_ANSWER', null, '오답'))
        if (step === 'FOLLOW' && !window.following) return Promise.resolve(envelope(409, 'WELCOME_QUEST_CONDITION_NOT_MET', null, '팔로우 필요'))
        const target = step === 'BONUS' ? window.quest.bonus : window.quest.items.find((item) => item.step === step)
        target.status = 'CLAIMED'
        window.quest.completed = window.quest.items.every((item) => item.status === 'CLAIMED')
        return Promise.resolve(envelope(202, 'EARN_ACCEPTED', { step, rewardAmount: 1, status: 'CLAIMED' }))
      }
      if (path === '/api/me/winners') return Promise.resolve(envelope(200, 'SUCCESS', []))
      if (/^\/api\/missions\/\d+\/complete$/.test(path)) return Promise.resolve(envelope(202, 'EARN_ACCEPTED', { status: 'PENDING' }))
      if (path === '/api/missions') return Promise.resolve(envelope(200, 'SUCCESS', [{ missionId: 1, type: 'ATTENDANCE', rewardAmount: 1, completedToday: false }]))
      if (path === '/api/tickets/common/history') return Promise.resolve(envelope(200, 'SUCCESS', { items: [], hasNext: false }))
      if (path === '/api/me/creator-recommendations') return Promise.resolve(envelope(200, 'SUCCESS', recommendations))
      return Promise.resolve(envelope(200, 'SUCCESS', { items: [], page: 0, hasNext: false }))
    }
  }, initialQuest)
  await page.addScriptTag({ content: bundle })
}

/** 지급(POST) 요청만 모아 돌려준다. */
const claims = (page) => page.evaluate(() => window.requests.filter((request) => request.method === 'POST' && request.path.includes('/claim')))

/** 화면 전체 문구 안에서 두 문구의 위치 순서를 비교하기 위해 본문 텍스트를 읽는다. */
const bodyText = (page) => page.evaluate(() => document.body.innerText)

/** 홈이 그려지고 웰컴 퀘스트 히어로가 보일 때까지 기다린다. */
const waitWelcome = (page) => page.getByText('무료 응모권 4장').waitFor()

test('신규 회원 홈은 웰컴 퀘스트, 출석, 인기 크리에이터 순서이고 응모 섹션은 숨긴다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByText('DAILY CHECK-IN').waitFor()
    await page.getByText('지금 팬들이 가장 많이 모이는 곳').waitFor()

    const text = await bodyText(page)
    const guide = text.indexOf('1분 만에 끝내는 시작 가이드')
    const attendance = text.indexOf('DAILY CHECK-IN')
    const creators = text.indexOf('지금 팬들이 가장 많이 모이는 곳')
    assert.ok(guide >= 0 && guide < attendance && attendance < creators, '퀘스트 → 출석 → 인기 크리에이터 순서')
    assert.equal(text.includes('마감 임박순'), false)
    assert.equal(await page.getByText('반가워요, 혁준님!').count(), 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('대상이 아닌 회원은 지금과 같은 홈을 본다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await page.getByText('DAILY CHECK-IN').waitFor()
    await page.getByText('마감 임박순').waitFor()
    const text = await bodyText(page)
    assert.equal(text.includes('1분 만에 끝내는 시작 가이드'), false)
    assert.equal(text.includes('지금 팬들이 가장 많이 모이는 곳'), false)
    assert.equal(await page.getByText('도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('STEP 1은 처음 표시될 때 한 번 자동으로 지급되고 응모권 갱신과 토스트가 따른다', async () => {
  const { page, errors } = await screen(quest())
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByText('응모권 +1장 지급 완료').waitFor()

    const posted = await claims(page)
    assert.deepEqual(posted.map((request) => request.path), ['/api/me/welcome-quest/SIGNUP/claim'])
    assert.deepEqual(Object.keys(posted[0].body), ['requestId'])
    assert.equal(await page.evaluate(() => window.ticketRefreshes), 1)
    assert.deepEqual(await page.evaluate(() => window.toasts), ['응모권 1장을 받았어요.'])
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '33')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('STEP 2는 팔로우 전에는 인기 크리에이터로 이동시키고, 팔로우하면 받을 수 있다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)

    await page.getByRole('button', { name: /STEP 2/ }).click()
    assert.equal(await page.evaluate(() => window.scrolled), 1)
    assert.equal((await claims(page)).length, 0)

    // 서버는 팔로우가 되면 FOLLOW를 받을 수 있는 상태로 알려 준다. 틀이 팔로우를 기록한 뒤 퀘스트 상태를 다시 불러온다.
    await page.evaluate(() => { window.quest.items[1].status = 'CLAIMABLE'; window.following = true })
    await page.getByRole('button', { name: '+ 팔로우' }).first().click()
    await page.waitForFunction(() => window.followCalls.length === 1)
    await page.waitForFunction(() => window.requests.filter((request) => request.path === '/api/me/welcome-quest').length >= 2)
    await page.getByRole('button', { name: /STEP 2.*받기/ }).click()
    // STEP 1은 이미 받은 상태라, STEP 2까지 받으면 "지급 완료"가 두 곳에 보인다.
    await page.waitForFunction(() => document.body.innerText.split('응모권 +1장 지급 완료').length - 1 === 2)
    const posted = await claims(page)
    assert.equal(posted.at(-1).path, '/api/me/welcome-quest/FOLLOW/claim')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('STEP 3은 펼쳐서 답을 서버에 보내고, 오답은 안내하고 정답이면 지급된다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByRole('button', { name: /STEP 3/ }).click()
    await page.getByText('5초 순삭 OX 퀴즈').waitFor()

    await page.getByRole('button', { name: 'X 아니다' }).click()
    await page.getByText('다시 생각해 보세요! 크킹에서는 무료로 응모권을 모을 수 있어요.').waitFor()
    assert.deepEqual((await claims(page)).map((request) => request.body.answer), [false])

    await page.getByRole('button', { name: 'O 맞다' }).click()
    await page.getByText('웰컴 퀘스트 완료!').waitFor()
    const posted = await claims(page)
    assert.equal(posted.at(-1).body.answer, true)
    assert.notEqual(posted[0].body.requestId, posted[1].body.requestId)
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '100')
    assert.equal(await page.getByRole('link', { name: /응모하러 가기/ }).getAttribute('href'), '/explore?tab=event')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('출석 도장을 누르면 다음 칸에 웰컴 보너스 도장이 이어서 찍히고, 받으면 지급 문구가 보인다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByText('도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!').waitFor()

    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const posted = await claims(page)
    assert.equal(posted.at(-1).path, '/api/me/welcome-quest/BONUS/claim')
    // 출석 도장 다음 칸(DAY 2)이 보너스로 찍힌다.
    assert.equal(await page.getByLabel('1번째 도장 찍힘').count(), 1)
    assert.equal(await page.getByLabel('2번째 도장 찍힘').count(), 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('퀘스트를 끝낸 뒤 다시 들어오면 일반 홈이고, 못 받은 보너스는 출석 카드에 남는다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED', QUIZ: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await page.getByText('마감 임박순').waitFor()
    const text = await bodyText(page)
    assert.equal(text.includes('1분 만에 끝내는 시작 가이드'), false)
    assert.equal(text.includes('웰컴 퀘스트 완료!'), false)
    await page.getByText('도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!').waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('가이드를 닫으면 출석이 위로 올라오고 새로고침 뒤에도 유지되며 다시 볼 수 있다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => { localStorage.clear(); window.renderHome([]) })
    await waitWelcome(page)

    await page.getByRole('button', { name: '가이드 닫기' }).click()
    await page.getByRole('button', { name: /시작 가이드 다시 보기/ }).waitFor()
    assert.equal(await page.getByText('무료 응모권 4장').count(), 0)
    assert.equal(await page.evaluate(() => localStorage.getItem('cking.welcomeGuideHidden.7')), '1')
    const text = await bodyText(page)
    assert.ok(text.indexOf('DAILY CHECK-IN') < text.indexOf('지금 팬들이 가장 많이 모이는 곳'))

    // 홈을 처음부터 다시 그려도(새로고침과 같음) 닫은 상태가 유지된다.
    await page.evaluate(() => window.renderHome([]))
    await page.getByRole('button', { name: /시작 가이드 다시 보기/ }).waitFor()

    await page.getByRole('button', { name: /시작 가이드 다시 보기/ }).click()
    await waitWelcome(page)
    assert.equal(await page.evaluate(() => localStorage.getItem('cking.welcomeGuideHidden.7')), null)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('저장소를 쓸 수 없어도 가이드 닫기는 이번 화면에서 동작한다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => {
      Storage.prototype.getItem = () => { throw new Error('blocked') }
      Storage.prototype.setItem = () => { throw new Error('blocked') }
      window.renderHome([])
    })
    await waitWelcome(page)
    await page.getByRole('button', { name: '가이드 닫기' }).click()
    await page.getByRole('button', { name: /시작 가이드 다시 보기/ }).waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('퀴즈 오답 뒤 새 답을 보낼 때 실패해도 이전 오답 안내는 남지 않는다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByRole('button', { name: /STEP 3/ }).click()

    await page.getByRole('button', { name: 'X 아니다' }).click()
    await page.getByText('다시 생각해 보세요!', { exact: false }).waitFor()

    await page.evaluate(() => { window.failClaims = 1 })
    await page.getByRole('button', { name: 'O 맞다' }).click()
    await page.waitForFunction(() => window.toasts.includes('서버 오류'))
    assert.equal(await page.getByText('다시 생각해 보세요!', { exact: false }).count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('같은 화면에서 회원이 바뀌면 이전 회원의 완료 유지 상태가 다른 회원에게 남지 않는다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([], 7))
    await waitWelcome(page)
    await page.getByRole('button', { name: /STEP 3/ }).click()
    await page.getByRole('button', { name: 'O 맞다' }).click()
    await page.getByText('웰컴 퀘스트 완료!').waitFor()

    // 이미 퀘스트를 끝낸 다른 회원으로 같은 화면에서 전환한다.
    await page.evaluate(() => {
      window.quest = { eligible: true, completed: true, bonus: { step: 'BONUS', rewardAmount: 1, status: 'CLAIMED' },
        items: ['SIGNUP', 'FOLLOW', 'QUIZ'].map((step) => ({ step, rewardAmount: 1, status: 'CLAIMED' })) }
      window.renderHome([], 8)
    })
    await page.getByText('마감 임박순').waitFor()
    assert.equal((await bodyText(page)).includes('웰컴 퀘스트 완료!'), false)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('같은 화면에서 회원이 바뀌면 추천 크리에이터를 다시 조회한다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([], 7))
    await waitWelcome(page)
    await page.getByRole('button', { name: '+ 팔로우' }).first().waitFor()
    const loads = () => page.evaluate(() => window.requests.filter((request) => request.path === '/api/me/creator-recommendations').length)
    assert.equal(await loads(), 1)

    await page.evaluate(() => window.renderHome([], 8))
    await page.waitForFunction(() => window.requests.filter((request) => request.path === '/api/me/creator-recommendations').length === 2)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('SIGNUP 자동 지급이 승인 불명으로 끝난 뒤 새로고침하면 같은 requestId로 복구한다', async () => {
  const { page, errors } = await screen(quest())
  try {
    await page.evaluate(() => { localStorage.clear(); window.failClaims = 1; window.renderHome([]) })
    await waitWelcome(page)
    await page.waitForFunction(() => window.toasts.includes('서버 오류'))
    const [first] = await claims(page)
    assert.equal(first.path, '/api/me/welcome-quest/SIGNUP/claim')

    // 새로고침: 서버에서는 아직 승인 전이라 CLAIMABLE로 조회된다. 자동 지급이 새 UUID를 만들지 않고 보존한 요청으로 복구해야 한다.
    await boot(page, quest())
    await page.evaluate(() => window.renderHome([]))
    await page.getByText('응모권 +1장 지급 완료').waitFor()

    const [retry] = await claims(page)
    assert.equal(retry.path, '/api/me/welcome-quest/SIGNUP/claim')
    assert.equal(retry.body.requestId, first.body.requestId)
    assert.equal(await page.evaluate(() => localStorage.getItem('cking.welcomeClaimAttempts.7')), null)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('퀘스트 상태 조회가 실패하면 다시 시도를 보여주고, 성공하면 신규 회원 홈이 나온다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => { window.questFailures = 1; window.renderHome([]) })
    await page.getByText('웰컴 퀘스트를 불러오지 못했어요.').waitFor()
    assert.equal((await bodyText(page)).includes('무료 응모권 4장'), false)

    await page.getByRole('button', { name: '다시 시도' }).click()
    await waitWelcome(page)
    assert.equal(await page.getByText('웰컴 퀘스트를 불러오지 못했어요.').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('같은 화면에서 회원이 바뀌어도 이전 회원이 받은 보너스 표시가 다른 회원의 출석 카드에 남지 않는다', async () => {
  // 세 단계를 모두 끝내 일반 홈을 쓰고 보너스만 남은 회원 A와 B다. 두 회원 모두 출석 카드가 같은 자리에서 쓰인다.
  const done = { SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED', QUIZ: 'CLAIMED' }
  const { page, errors } = await screen(quest(done))
  try {
    await page.evaluate(() => window.renderHome([], 7))
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()

    // 회원 B로 전환한다. B의 보너스는 아직 받을 수 있는 상태다.
    await page.evaluate((next) => { window.quest = next; window.renderHome([], 8) }, quest(done))
    await page.getByText('도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!').waitFor()
    assert.equal(await page.getByLabel('2번째 도장 찍힘').count(), 0)

    // B도 정상적으로 지급받을 수 있다.
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const bonusClaims = (await claims(page)).filter((request) => request.path === '/api/me/welcome-quest/BONUS/claim')
    assert.equal(bonusClaims.length, 2)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
