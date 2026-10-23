import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
    window.failComplete = false
    window.missionDone = false
    window.winners = []
    window.winnersFail = false
    window.winnersGate = null
    window.failEvents = false
    window.questFailures = 0
    Element.prototype.scrollIntoView = () => { window.scrolled += 1 }
    const envelope = (status, code, data, message = null) => new Response(JSON.stringify({ code, data, message }), { status })
    const recommendations = {
      policyVersion: 'INTEREST_PERSONALIZED_V1',
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
      if (path === '/api/me/winners') {
        // winnersGate가 있으면 테스트가 풀어 줄 때까지 응답을 미룬다. 진행 중인 요청이 나중에 끝나는 상황을 만든다.
        if (window.winnersGate) {
          const gate = window.winnersGate
          return gate.then(() => envelope(200, 'SUCCESS', window.winners))
        }
        if (window.winnersFail) return Promise.resolve(envelope(500, 'INTERNAL_SERVER_ERROR', null, '조회 실패'))
        return Promise.resolve(envelope(200, 'SUCCESS', window.winners))
      }
      if (path === '/api/events' && window.failEvents) return Promise.resolve(envelope(500, 'INTERNAL_SERVER_ERROR', null, '조회 실패'))
      if (/^\/api\/missions\/\d+\/complete$/.test(path)) {
        if (window.failComplete) return Promise.resolve(envelope(500, 'INTERNAL_SERVER_ERROR', null, '서버 오류'))
        return Promise.resolve(envelope(202, 'EARN_ACCEPTED', { status: 'PENDING' }))
      }
      if (path === '/api/missions') return Promise.resolve(envelope(200, 'SUCCESS', [{ missionId: 1, type: 'ATTENDANCE', rewardAmount: 1, completedToday: window.missionDone }]))
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

test('STEP 2는 팔로우 전에는 추천 크리에이터로 이동시키고, 팔로우하면 받을 수 있다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)

    await page.getByRole('button', { name: /STEP 2/ }).click()
    assert.equal(await page.evaluate(() => window.scrolled), 1)
    assert.equal((await claims(page)).length, 0)

    // 서버는 팔로우가 되면 FOLLOW를 받을 수 있는 상태로 알려 준다. 틀이 팔로우를 기록한 뒤 퀘스트 상태를 다시 불러온다.
    await page.evaluate(() => { window.quest.items[1].status = 'CLAIMABLE'; window.following = true })
    await page.getByRole('button', { name: '+ 도킹' }).first().click()
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

test('출석 도장을 누르면 웰컴 보너스가 이어서 지급되고, 보너스는 출석 도장 칸에 찍히지 않는다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await waitWelcome(page)
    await page.getByText('도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!').waitFor()

    await page.getByRole('button', { name: '도장 찍기' }).click()
    // 출석 → 보너스를 잇는 동안에는 처리 중으로 잠겨 다시 누를 수 없다.
    assert.equal(await page.getByRole('button', { name: '처리 중' }).isDisabled(), true)
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const posted = await claims(page)
    assert.equal(posted.at(-1).path, '/api/me/welcome-quest/BONUS/claim')
    // 보너스는 출석 일수가 아니므로 출석 도장(DAY 1)만 찍히고 DAY 2는 비어 있다.
    assert.equal(await page.getByLabel('1번째 도장 찍힘').count(), 1)
    assert.equal(await page.getByLabel('2번째 도장 찍힘').count(), 0)
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
    await page.waitForFunction(() => window.toasts.includes('응모권을 받지 못했어요. 다시 눌러 주세요.'))
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
    await page.getByRole('button', { name: '+ 도킹' }).first().waitFor()
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
    await page.waitForFunction(() => window.toasts.includes('응모권을 받지 못했어요. 다시 눌러 주세요.'))
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
    assert.equal(await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').count(), 0)

    // B도 정상적으로 지급받을 수 있다.
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const bonusClaims = (await claims(page)).filter((request) => request.path === '/api/me/welcome-quest/BONUS/claim')
    assert.equal(bonusClaims.length, 2)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

/** 출석 완료와 보너스 지급(POST) 요청만 순서대로 모아 돌려준다. */
const attendanceAndBonus = (page) => page.evaluate(() => window.requests
  .filter((request) => request.method === 'POST' && (request.path.includes('/complete') || request.path.includes('/BONUS/claim')))
  .map((request) => ({ path: request.path, requestId: request.body?.requestId })))

test('출석 요청이 실패하면 보너스는 요청하지 않고, 다시 눌러 같은 요청으로 재시도하면 둘 다 처리된다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => { window.failComplete = true; window.renderHome([]) })
    await waitWelcome(page)
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.waitForFunction(() => window.toasts.length > 0)
    // 보너스를 요청할 시간이 충분히 지나도 출석 요청 한 번만 있고 보너스 요청은 없다.
    await page.waitForTimeout(900)
    let posted = await attendanceAndBonus(page)
    assert.deepEqual(posted.map((request) => request.path), ['/api/missions/1/complete'])
    assert.equal(await page.getByRole('button', { name: '도장 찍기' }).isEnabled(), true)

    // 서버 처리 여부가 불확실한 실패라서 같은 requestId로 다시 보내고, 이번에는 보너스까지 이어진다.
    await page.evaluate(() => { window.failComplete = false })
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    posted = await attendanceAndBonus(page)
    assert.deepEqual(posted.map((request) => request.path), ['/api/missions/1/complete', '/api/missions/1/complete', '/api/me/welcome-quest/BONUS/claim'])
    assert.equal(posted[0].requestId, posted[1].requestId)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('이미 출석한 회원은 출석 요청 없이 보너스만 받을 수 있다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => { window.missionDone = true; window.renderHome([]) })
    await waitWelcome(page)
    await page.getByRole('button', { name: '보너스 받기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const posted = await attendanceAndBonus(page)
    assert.deepEqual(posted.map((request) => request.path), ['/api/me/welcome-quest/BONUS/claim'])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('보너스 지급이 실패해도 출석은 유지되고, 다시 눌러 같은 요청으로 재시도할 수 있다', async () => {
  const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
  try {
    await page.evaluate(() => { window.failClaims = 1; window.renderHome([]) })
    await waitWelcome(page)
    await page.getByRole('button', { name: '도장 찍기' }).click()
    // 출석은 끝났지만 보너스가 실패해 버튼이 보너스 받기로 남는다.
    await page.getByRole('button', { name: '보너스 받기' }).waitFor()
    assert.equal(await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').count(), 0)

    await page.getByRole('button', { name: '보너스 받기' }).click()
    await page.getByText('웰컴 보너스 응모권 +1장이 지급되었어요!').waitFor()
    const posted = await attendanceAndBonus(page)
    // 출석은 한 번만, 보너스는 실패 뒤 같은 requestId로 한 번 더 보낸다.
    assert.deepEqual(posted.map((request) => request.path), [
      '/api/missions/1/complete', '/api/me/welcome-quest/BONUS/claim', '/api/me/welcome-quest/BONUS/claim',
    ])
    assert.equal(posted[1].requestId, posted[2].requestId)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('출석 뒤 보너스를 기다리는 사이 계정을 바꾸거나 화면을 내리면 보너스를 요청하지 않는다', async () => {
  for (const leave of [(page) => page.evaluate(() => window.renderHome([], 8)), (page) => page.evaluate(() => window.unmountHome())]) {
    const { page, errors } = await screen(quest({ SIGNUP: 'CLAIMED' }))
    try {
      await page.evaluate(() => window.renderHome([], 7))
      await waitWelcome(page)
      await page.getByRole('button', { name: '도장 찍기' }).click()
      // 출석이 끝나고 보너스 요청 전의 대기 시간에 떠난다.
      await page.waitForFunction(() => window.toasts.some((message) => String(message).includes('적립했어요')))
      await leave(page)
      await page.waitForTimeout(1200)
      const posted = await attendanceAndBonus(page)
      assert.equal(posted.some((request) => request.path.includes('/BONUS/claim')), false)
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  }
})

test('도장을 찍으면 고리·반짝이 장식이 그려지고, 모션을 줄인 환경에서는 CSS가 그 장식을 숨긴다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await page.getByRole('button', { name: '도장 찍기' }).click()
    await page.locator('.stamp-burst').first().waitFor({ state: 'attached' })
    assert.deepEqual(errors, [])
  } finally { await page.close() }

  // 하네스 페이지에는 스타일시트가 없으므로, 모션 감소 규칙이 장식을 숨기는지는 CSS 원문으로 확인한다.
  const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8')
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.stamp-burst\s*\{\s*display:\s*none;?\s*\}/)
  assert.ok(reduced, 'prefers-reduced-motion: reduce 안에서 .stamp-burst를 숨겨야 한다')
})

test('일반 홈은 진행 중 이벤트를 병렬로 받고, 잔액은 응모에 보이는 크리에이터 것만 조회한다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => {
      const base = window.fetch
      window.urls = []
      const day = 86400000
      const event = (eventId, creatorId, days) => ({ eventId, creatorId, title: `이벤트${eventId}`, displayStatus: 'IN_PROGRESS', endAt: new Date(Date.now() + days * day).toISOString() })
      // 진행 중 이벤트 3페이지. 마감이 가장 빠른 3건은 크리에이터 1·2·3의 이벤트이고, 4번 크리에이터 이벤트는 밀려난다.
      const pages = [[event(1, 1, 3)], [event(2, 2, 1)], [event(3, 3, 2), event(4, 4, 30)]]
      window.fetch = (url, options) => {
        const parsed = new URL(String(url), location.href)
        window.urls.push(parsed.pathname + parsed.search)
        if (parsed.pathname === '/api/events' && parsed.searchParams.get('status') === 'IN_PROGRESS') {
          const index = Number(parsed.searchParams.get('page'))
          const data = { items: pages[index], page: index, totalPages: pages.length, hasNext: index < pages.length - 1 }
          return Promise.resolve(new Response(JSON.stringify({ code: 'SUCCESS', data, message: null }), { status: 200 }))
        }
        return base(url, options)
      }
      window.renderHome([1, 2, 3, 4, 5])
    })
    await page.getByText('이벤트1').first().waitFor()
    const urls = await page.evaluate(() => window.urls)
    const inProgressPages = urls.filter((url) => url.includes('status=IN_PROGRESS')).map((url) => new URL(url, 'http://x').searchParams.get('page')).sort()
    assert.deepEqual(inProgressPages, ['0', '1', '2'])
    // 이벤트 100건을 함께 받던 예전 목록 조회(상태 필터 없음)는 홈에서 나가지 않는다.
    assert.equal(urls.some((url) => url.startsWith('/api/events?') && !url.includes('status=')), false)
    const balanceCreators = urls.map((url) => url.match(/^\/api\/creators\/(\d+)\/tickets$/)?.[1]).filter(Boolean).sort()
    assert.deepEqual(balanceCreators, ['1', '2', '3'])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('회원이 바뀌어 새 회원의 당첨 조회가 실패해도 이전 회원의 당첨 배너는 남지 않는다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => {
      window.winners = [{ winnerId: 1, winnerManagementStatus: 'SELECTED' }]
      window.renderHome([], 7)
    })
    await page.getByText('수령 대기 1건').waitFor()

    // 회원 B로 전환한다. B의 당첨 조회는 실패하므로, 이전 회원 A의 결과가 남아 있으면 배너가 그대로 보인다.
    await page.evaluate(() => {
      window.winnersFail = true
      window.renderHome([], 8)
    })
    await page.waitForFunction(() => window.requests.filter((request) => request.path === '/api/me/winners').length >= 2)
    await page.waitForTimeout(100)
    assert.equal(await page.getByText('수령 대기 1건').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('캐시로 그린 홈은 뒤에서 하는 이벤트 갱신이 실패해도 지워지지 않는다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderHome([]))
    await page.getByText('마감 임박순').waitFor()
    const before = await page.evaluate(() => window.requests.filter((request) => request.path === '/api/events').length)

    // 홈을 내렸다가 이벤트 조회가 실패하는 상태로 다시 연다. 캐시된 목록이 먼저 보이고 뒤의 갱신만 실패한다.
    await page.evaluate(() => {
      window.unmountHome()
      window.failEvents = true
    })
    await page.evaluate(() => window.renderHome([]))
    await page.waitForFunction((count) => window.requests.filter((request) => request.path === '/api/events').length > count, before)
    await page.waitForTimeout(100)
    assert.equal(await page.getByText('마감 임박순').count(), 1)
    assert.equal((await bodyText(page)).includes('진행 중인 이벤트를 불러오지 못했습니다.'), false)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('로그아웃으로 캐시를 비운 뒤 이전 요청이 끝나도 이전 회원의 결과는 캐시에 다시 저장되지 않는다', async () => {
  const { page, errors } = await screen(quest({ eligible: false }))
  try {
    // 회원 A의 당첨 조회를 미뤄 둔 채 로그아웃(캐시 비우기)하고 화면을 내린다.
    await page.evaluate(() => {
      window.winners = [{ winnerId: 1, winnerManagementStatus: 'SELECTED' }]
      window.winnersGate = new Promise((resolve) => { window.releaseWinners = resolve })
      window.renderHome([], 7)
    })
    await page.waitForFunction(() => window.requests.some((request) => request.path === '/api/me/winners'))
    await page.evaluate(() => { window.clearAsyncCache(); window.unmountHome() })

    // 이전 요청이 이제 끝난다.
    await page.evaluate(() => window.releaseWinners())
    await page.waitForTimeout(100)

    // 같은 키로 다시 열면, 캐시에 남은 이전 결과가 있다면 응답 전에 배너가 바로 보인다. 이번 조회는 끝나지 않게 둔다.
    await page.evaluate(() => {
      window.winnersGate = new Promise(() => {})
      window.renderHome([], 7)
    })
    await page.getByText('DAILY CHECK-IN').waitFor()
    await page.waitForTimeout(100)
    assert.equal(await page.getByText('수령 대기 1건').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('조회가 비활성화되면 진행 중이던 이전 요청의 결과는 현재 화면에 반영되지 않는다', async () => {
  const { page } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderProbe({ tag: 'A', enabled: true }))
    await page.waitForFunction(() => typeof window.probeGates.A === 'function')
    await page.evaluate(() => window.renderProbe({ tag: 'A', enabled: false }))
    // 비활성화가 화면에 반영되고 효과까지 정리된 뒤에 이전 요청을 끝낸다.
    await page.locator('#probe[data-enabled="false"]').waitFor()
    await page.waitForTimeout(50)
    await page.evaluate(() => window.probeGates.A())
    await page.waitForTimeout(100)
    assert.equal(await page.locator('#probe').innerText(), 'none')
  } finally { await page.close() }
})

test('캐시키가 바뀌면 이전 키의 요청이 늦게 끝나도 새 키의 결과를 덮어쓰지 않는다', async () => {
  const { page } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderProbe({ tag: 'A', cacheKey: 'probe:A' }))
    await page.waitForFunction(() => typeof window.probeGates.A === 'function')
    await page.evaluate(() => window.renderProbe({ tag: 'B', cacheKey: 'probe:B' }))
    await page.waitForFunction(() => typeof window.probeGates.B === 'function')
    await page.evaluate(() => window.probeGates.B())
    await page.waitForFunction(() => document.querySelector('#probe').innerText === 'B')
    await page.evaluate(() => window.probeGates.A())
    await page.waitForTimeout(100)
    assert.equal(await page.locator('#probe').innerText(), 'B')
  } finally { await page.close() }
})

test('같은 캐시키의 두 요청이 역순으로 끝나도 더 늦게 시작한 요청의 결과가 캐시에 남는다', async () => {
  const { page } = await screen(quest({ eligible: false }))
  try {
    // 같은 키로 먼저 A, 이어서 B를 요청한 뒤 B가 먼저 끝나고 오래된 A가 나중에 끝난다.
    await page.evaluate(() => window.renderProbe({ tag: 'A', cacheKey: 'probe:same' }))
    await page.waitForFunction(() => typeof window.probeGates.A === 'function')
    await page.evaluate(() => window.renderProbe({ tag: 'B', cacheKey: 'probe:same' }))
    await page.waitForFunction(() => typeof window.probeGates.B === 'function')
    await page.evaluate(() => window.probeGates.B())
    await page.waitForFunction(() => document.querySelector('#probe').innerText === 'B')
    await page.evaluate(() => window.probeGates.A())
    await page.waitForTimeout(100)

    // 화면을 내렸다가 같은 키로 다시 열면 캐시된 값이 먼저 보인다. 이번 조회(C)는 끝나지 않게 둔다.
    await page.evaluate(() => window.unmountHome())
    await page.evaluate(() => window.renderProbe({ tag: 'C', cacheKey: 'probe:same' }))
    await page.waitForFunction(() => typeof window.probeGates.C === 'function')
    assert.equal(await page.locator('#probe').innerText(), 'B')
  } finally { await page.close() }
})

test('지연 로딩한 화면을 받지 못하면 빈 화면 대신 안내와 다시 시도를 보여준다', async () => {
  const { page } = await screen(quest({ eligible: false }))
  try {
    await page.evaluate(() => window.renderBrokenLazy())
    await page.getByText('화면을 불러오지 못했어요. 네트워크를 확인한 뒤 새로고침해 주세요.').waitFor()
    await page.getByRole('button', { name: '다시 시도' }).waitFor()
  } finally { await page.close() }
})
