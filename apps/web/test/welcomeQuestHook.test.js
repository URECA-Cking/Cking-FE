import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

const QUEST = {
  eligible: true,
  completed: false,
  items: [
    { step: 'SIGNUP', rewardAmount: 1, status: 'CLAIMABLE' },
    { step: 'FOLLOW', rewardAmount: 1, status: 'NOT_MET' },
    { step: 'QUIZ', rewardAmount: 1, status: 'CLAIMABLE' },
  ],
  bonus: { step: 'BONUS', rewardAmount: 1, status: 'CLAIMABLE' },
}

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/welcomeQuestBrowser.jsx', import.meta.url)), name: 'WelcomeQuestTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/**
 * 외부 요청을 막은 빈 화면에 번들을 올리고, fetch를 큐로 바꿔 테스트가 응답을 순서대로 정한다.
 * 조회(GET)는 항상 QUEST를 돌려주고, 지급(POST)은 window.claimResponses에 넣어 둔 응답을 차례로 꺼내 쓴다.
 */
async function screen() {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/welcome-quest-test')
  await page.evaluate((quest) => {
    window.requests = []
    window.claimResponses = []
    window.pending = {}
    const envelope = (status, code, data, message = null) => new Response(JSON.stringify({ code, data, message }), { status })
    window.fetch = (url, options) => {
      const body = options.body ? JSON.parse(options.body) : null
      window.requests.push({ url: new URL(String(url), location.href).pathname, method: options.method, body })
      if (options.method === 'GET') return Promise.resolve(envelope(200, 'SUCCESS', quest))
      const next = window.claimResponses.shift()
      // deferred 응답은 테스트가 resolvePending으로 직접 끝낼 때까지 대기시킨다.
      if (next.deferred) return new Promise((resolve) => { window.pending[next.step] = () => resolve(envelope(next.status, next.code, next.data ?? null)) })
      return Promise.resolve(envelope(next.status, next.code, next.data ?? null, next.message ?? null))
    }
  }, QUEST)
  await page.addScriptTag({ content: bundle })
  return { page, errors }
}

/** 화면에 드러난 훅 상태를 읽는다. */
const read = (page, testId) => page.getByTestId(testId).textContent()

/** 상태 조회가 끝나 대상 회원으로 표시될 때까지 기다린다. */
const waitLoaded = (page) => page.waitForFunction(() => document.querySelector('[data-testid="eligible"]')?.textContent === 'true')

/** 확인용 컴포넌트에서 testId 항목의 문구가 조건을 만족할 때까지 기다린다. */
const waitText = (page, testId, expected) => page.waitForFunction(
  ({ id, text }) => document.querySelector(`[data-testid="${id}"]`)?.textContent.startsWith(text),
  { id: testId, text: expected },
)

/** 지급을 요청하고 훅이 돌려준(또는 던진) 결과를 가져온다. */
async function claim(page, step, options) {
  await page.evaluate(({ target, claimOptions }) => window.claimStep(target, claimOptions), { target: step, claimOptions: options })
  return page.evaluate(() => window.claimResult)
}

/** 지급(POST) 요청만 모아 돌려준다. */
const posts = (page) => page.evaluate(() => window.requests.filter((request) => request.method === 'POST'))

/** 지급 승인 응답(202)을 만든다. */
const accepted = (step) => ({ status: 202, code: 'EARN_ACCEPTED', data: { step, rewardAmount: 1, status: 'CLAIMED' } })

test('회원이 있으면 상태를 조회해 단계별 상태를 보여준다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    assert.equal(await read(page, 'items'), 'SIGNUP:CLAIMABLE,FOLLOW:NOT_MET,QUIZ:CLAIMABLE')
    assert.equal(await read(page, 'bonus'), 'CLAIMABLE')
    const requests = await page.evaluate(() => window.requests)
    assert.deepEqual(requests.map((request) => [request.method, request.url]), [['GET', '/api/me/welcome-quest']])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('회원이 없으면 조회하지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(null))
    await page.getByTestId('loading').waitFor()
    assert.equal(await page.evaluate(() => window.requests.length), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('일반 단계 지급은 requestId만 보내고 성공하면 CLAIMED로 맞춘다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate((response) => window.claimResponses.push(response), accepted('SIGNUP'))

    const result = await claim(page, 'SIGNUP')

    assert.equal(result.ok, true)
    const [request] = await posts(page)
    assert.equal(request.url, '/api/me/welcome-quest/SIGNUP/claim')
    assert.deepEqual(Object.keys(request.body), ['requestId'])
    await waitText(page, 'items', 'SIGNUP:CLAIMED')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('승인 여부가 불확실한 실패 뒤 재시도는 같은 requestId를 쓰고, 성공하면 정리된다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push(
      { status: 504, code: 'EARN_STATUS_UNKNOWN', message: '확인할 수 없어요' },
      { status: 200, code: 'ALREADY_PROCESSED', data: { step: 'SIGNUP', rewardAmount: 1, status: 'CLAIMED' } },
    ))

    assert.deepEqual(await claim(page, 'SIGNUP'), { ok: false, code: 'EARN_STATUS_UNKNOWN' })
    assert.equal((await read(page, 'items')).startsWith('SIGNUP:CLAIMABLE'), true)

    assert.equal((await claim(page, 'SIGNUP')).ok, true)
    const [firstPost, secondPost] = await posts(page)
    assert.equal(firstPost.body.requestId, secondPost.body.requestId)
    await waitText(page, 'items', 'SIGNUP:CLAIMED')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('QUIZ는 answer를 함께 보내고, 오답 뒤 다시 시도하면 새 requestId를 쓴다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate((response) => window.claimResponses.push(
      { status: 409, code: 'WELCOME_QUEST_WRONG_ANSWER', message: '오답이에요' },
      response,
    ), accepted('QUIZ'))

    assert.deepEqual(await claim(page, 'QUIZ', { answer: false }), { ok: false, code: 'WELCOME_QUEST_WRONG_ANSWER' })
    assert.equal((await claim(page, 'QUIZ', { answer: true })).ok, true)

    const [wrong, right] = await posts(page)
    assert.equal(wrong.body.answer, false)
    assert.equal(right.body.answer, true)
    assert.notEqual(wrong.body.requestId, right.body.requestId)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('다른 요청으로 이미 지급된 단계는 실패로 보이지 않고 CLAIMED로 맞춘다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push({ status: 409, code: 'WELCOME_QUEST_ALREADY_CLAIMED', message: '이미 받았어요' }))

    const result = await claim(page, 'SIGNUP')

    assert.equal(result.ok, true)
    assert.equal(result.value.alreadyClaimed, true)
    await waitText(page, 'items', 'SIGNUP:CLAIMED')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('조건 미충족 같은 확정 실패는 상태를 바꾸지 않고 오류를 그대로 던진다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push({ status: 409, code: 'WELCOME_QUEST_CONDITION_NOT_MET', message: '팔로우가 필요해요' }))

    assert.deepEqual(await claim(page, 'FOLLOW'), { ok: false, code: 'WELCOME_QUEST_CONDITION_NOT_MET' })
    assert.equal(await read(page, 'items'), 'SIGNUP:CLAIMABLE,FOLLOW:NOT_MET,QUIZ:CLAIMABLE')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('세 단계를 모두 받으면 completed가 되고, 보너스는 따로 CLAIMED가 된다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate((responses) => window.claimResponses.push(...responses), ['SIGNUP', 'FOLLOW', 'QUIZ', 'BONUS'].map(accepted))

    await claim(page, 'SIGNUP')
    await claim(page, 'FOLLOW')
    assert.equal(await read(page, 'completed'), 'false')
    await claim(page, 'QUIZ', { answer: true })
    await waitText(page, 'completed', 'true')
    assert.equal(await read(page, 'bonus'), 'CLAIMABLE')
    await claim(page, 'BONUS')
    await waitText(page, 'bonus', 'CLAIMED')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('여러 단계를 동시에 요청해도 먼저 끝난 단계가 다른 단계의 진행 표시를 지우지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push(
      { deferred: true, step: 'SIGNUP', status: 202, code: 'EARN_ACCEPTED', data: { step: 'SIGNUP', rewardAmount: 1, status: 'CLAIMED' } },
      { deferred: true, step: 'BONUS', status: 202, code: 'EARN_ACCEPTED', data: { step: 'BONUS', rewardAmount: 1, status: 'CLAIMED' } },
    ))

    await page.evaluate(() => { window.claimStep('SIGNUP'); window.claimStep('BONUS') })
    await waitText(page, 'claiming', 'SIGNUP,BONUS')

    await page.evaluate(() => window.pending.SIGNUP())
    await waitText(page, 'items', 'SIGNUP:CLAIMED')
    assert.equal(await read(page, 'claiming'), 'BONUS')

    await page.evaluate(() => window.pending.BONUS())
    await waitText(page, 'bonus', 'CLAIMED')
    await page.waitForFunction(() => document.querySelector('[data-testid="claiming"]').textContent === '')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('같은 단계를 진행 중에 다시 요청하면 보내지 않고 null을 돌려준다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push(
      { deferred: true, step: 'SIGNUP', status: 202, code: 'EARN_ACCEPTED', data: { step: 'SIGNUP', rewardAmount: 1, status: 'CLAIMED' } },
    ))
    await page.evaluate(() => { window.claimStep('SIGNUP') })
    await waitText(page, 'claiming', 'SIGNUP')

    const duplicate = await claim(page, 'SIGNUP')

    assert.deepEqual(duplicate, { ok: true, value: null })
    assert.equal((await posts(page)).length, 1)
    await page.evaluate(() => window.pending.SIGNUP())
    await waitText(page, 'items', 'SIGNUP:CLAIMED')
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('회원이 바뀌면 이전 회원의 requestId를 재사용하지 않는다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderWelcomeQuest(7))
    await waitLoaded(page)
    await page.evaluate(() => window.claimResponses.push({ status: 504, code: 'EARN_STATUS_UNKNOWN', message: '확인할 수 없어요' }))
    assert.equal((await claim(page, 'SIGNUP')).ok, false)

    await page.evaluate(() => window.renderWelcomeQuest(8))
    await page.waitForFunction(() => window.requests.filter((request) => request.method === 'GET').length === 2)
    await waitLoaded(page)
    await page.evaluate((response) => window.claimResponses.push(response), accepted('SIGNUP'))
    assert.equal((await claim(page, 'SIGNUP')).ok, true)

    const [first, second] = await posts(page)
    assert.notEqual(first.body.requestId, second.body.requestId)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
