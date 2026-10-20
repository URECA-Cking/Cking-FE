import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const key = 'cking.creatorQuizJobs.v1.10'
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const input = { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', title: '테스트 Quiz', questionCount: 3 }
const entry = (kind, n, id = null) => kind === 'generation'
  ? { requestId: uuid(n), input, generationId: id, savedAt: Date.now() }
  : { requestId: uuid(n), quizId: 1, revisionId: 100, evaluationId: id, savedAt: Date.now() }
const jobs = (kind, value) => ({ generation: kind === 'generation' ? value : null, judges: kind === 'judge' ? { 100: value } : {} })
let bundle, browser
test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://quiz.test'), 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/quizJobsBrowser.jsx', import.meta.url)), name: 'QuizTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((item) => item.type === 'chunk').code
  const paths = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen(kind, initial = null, context = null) {
  const page = context ? await context.newPage() : await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // 외부 통신은 전부 차단하고 실제 컴포넌트가 호출하는 fetch를 메모리 큐로 받는다.
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  // localhost 문맥은 Web Locks를 지원한다. 문서는 위 route가 메모리에서 반환하며 서버를 실행하지 않는다.
  await page.goto('http://localhost/quiz-test')
  await page.evaluate(({ key, initial, kind, realStorage }) => {
    const nativeStorage = window.localStorage
    if (realStorage && initial) nativeStorage.setItem(key, JSON.stringify(initial))
    const values = new Map(initial ? [[key, JSON.stringify(initial)]] : [])
    window.storageFailure = { read: false, write: false, reserveConflict: false }
    let reservationReads = 0
    window.readStored = () => JSON.parse((realStorage ? nativeStorage.getItem(key) : values.get(key)) ?? 'null')
    window.storeOther = (value, notify = true) => {
      values.set(key, JSON.stringify(value))
      if (notify) window.dispatchEvent(new StorageEvent('storage', { key }))
    }
    if (!realStorage) Object.defineProperty(window, 'localStorage', { value: {
      getItem: (name) => {
        if (window.storageFailure.read) throw Error('SecurityError')
        if (window.storageFailure.reserveConflict && ++reservationReads === 2) {
          window.storageFailure.reserveConflict = false
          values.set(name, JSON.stringify(window.conflictingJobs))
        }
        return values.get(name) ?? null
      },
      setItem: (name, value) => {
        if (window.storageFailure.write) throw Error('QuotaExceededError')
        values.set(name, value)
      },
      removeItem: (name) => values.delete(name),
    } })
    window.posts = []
    window.reply = (index, status, data, code = 'SUCCESS') => window.posts[index].resolve(new Response(JSON.stringify({ code, data }), { status }))
    window.lose = (index) => window.posts[index].reject(TypeError('Failed to fetch'))
    window.fetch = (url, options) => {
      if (options.method === 'POST') return new Promise((resolve, reject) => window.posts.push({ body: JSON.parse(options.body), resolve, reject }))
      const path = new URL(url).pathname
      const data = path.endsWith('/revisions/100')
        ? { quizId: 1, revisionId: 100, reviewStatus: 'PENDING_REVIEW', latest: true, questions: [] }
        : path.endsWith('/quizzes/1')
          ? { quizId: 1, publicationStatus: 'NOT_PUBLISHED', revisions: [{ revisionId: 100, title: '테스트 Quiz' }] }
          : kind === 'generation'
            ? { generationId: Number(path.split('/').at(-1)), status: 'RUNNING' }
            : { evaluationId: Number(path.split('/').at(-1)), revisionId: 100, status: 'RUNNING', attempt: 2, maxAttempts: 2 }
      return Promise.resolve(new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 }))
    }
  }, { key, initial, kind, realStorage: context !== null })
  await page.addScriptTag({ content: bundle })
  assert.deepEqual(errors, [])
  await page.evaluate((kind) => window.renderQuiz(kind), kind)
  // 초기 저장소 조회가 끝난 뒤 장애/경쟁을 주입해 요청 직전 조회와 예약 조회 사이를 정확히 검증한다.
  if (kind === 'generation') await page.getByRole('button', { name: 'AI Quiz 만들기', exact: false }).waitFor()
  else await page.getByRole('region', { name: 'GPT Judge 평가', exact: true }).waitFor()
  return page
}
async function send(page, kind, recovery = false) {
  if (kind === 'judge') { await page.getByRole('button', { name: recovery ? '평가 요청 다시 확인' : '평가 요청', exact: true }).click(); return }
  if (recovery) { await page.getByRole('button', { name: '다시 확인', exact: true }).click(); return }
  await page.getByRole('button', { name: 'AI Quiz 만들기', exact: false }).click()
  const inputs = page.locator('input')
  await inputs.nth(0).fill(input.youtubeUrl)
  await inputs.nth(1).fill(input.title)
  await page.getByRole('button', { name: '생성', exact: true }).click()
}
for (const kind of ['generation', 'judge']) {
  for (const order of ['success-first', 'failure-first', 'waiting']) {
    test(`${kind}: 공유 localStorage 두 탭의 동일 R1 ${order} 응답 순서에서 복구 정보를 보존한다`, async () => {
      const context = await browser.newContext()
      try {
        const a = await screen(kind, null, context)
        await send(a, kind)
        await a.waitForFunction(() => window.posts.length === 1)
        const requestId = await a.evaluate(() => window.posts[0].body.requestId)
        const b = await screen(kind, null, context)
        await send(b, kind, true)
        await b.waitForFunction(() => window.posts.length === 1)
        assert.equal(await b.evaluate(() => window.posts[0].body.requestId), requestId)
        const succeed = async () => {
          await b.evaluate((kind) => window.reply(0, 202, kind === 'generation'
            ? { generationId: 11, status: 'PENDING' }
            : { evaluationId: 11, revisionId: 100, status: 'PENDING' }), kind)
          await b.waitForFunction(({ key, kind }) => {
            const value = JSON.parse(localStorage.getItem(key))
            return (kind === 'generation' ? value.generation?.generationId : value.judges['100']?.evaluationId) === 11
          }, { key, kind })
        }
        if (order === 'success-first') await succeed()
        await a.evaluate(() => window.reply(0, 403, null, 'FORBIDDEN'))
        // 실패 핸들러가 실제로 처리한 문구를 기다린다. 고정 sleep으로 성공 여부를 추정하지 않는다.
        await a.getByText('내 Quiz만 관리할 수 있어요. Creator 계정인지 확인해 주세요.', { exact: true }).waitFor()
        const saved = await a.evaluate(() => window.readStored())
        const current = kind === 'generation' ? saved?.generation : saved?.judges['100']
        assert.equal(current?.requestId, requestId)
        if (order === 'success-first') assert.equal(kind === 'generation' ? current.generationId : current.evaluationId, 11)
        if (order === 'failure-first') await succeed()
      } finally { await context.close() }
    })
  }
  test(`${kind}: 명확한 단독 기능 OFF 거절은 새 요청을 막지 않는다`, async () => {
    const page = await screen(kind)
    try {
      await send(page, kind)
      await page.waitForFunction(() => window.posts.length === 1)
      const firstId = await page.evaluate(() => window.posts[0].body.requestId)
      await page.evaluate((kind) => window.reply(0, 503, null, kind === 'generation' ? 'QUIZ_GENERATION_DISABLED' : 'QUIZ_JUDGE_DISABLED'), kind)
      await page.waitForFunction(({ key, kind }) => {
        const stored = window.readStored()
        return (kind === 'generation' ? stored?.generation : stored?.judges['100']) == null
      }, { key, kind })
      if (kind === 'generation') await page.getByRole('button', { name: '생성', exact: true }).click()
      else await send(page, kind)
      await page.waitForFunction(() => window.posts.length === 2)
      assert.notEqual(await page.evaluate(() => window.posts[1].body.requestId), firstId)
    } finally { await page.close() }
  })
  test(`${kind}: 한 탭의 503만으로 같은 UUID의 다른 대기 POST를 삭제하지 않는다`, async () => {
    const context = await browser.newContext()
    try {
      const a = await screen(kind, null, context)
      await send(a, kind)
      await a.waitForFunction(() => window.posts.length === 1)
      const requestId = await a.evaluate(() => window.posts[0].body.requestId)
      const b = await screen(kind, null, context)
      await send(b, kind, true)
      await b.waitForFunction(() => window.posts.length === 1)
      await a.evaluate((kind) => window.reply(0, 503, null, kind === 'generation' ? 'QUIZ_GENERATION_DISABLED' : 'QUIZ_JUDGE_DISABLED'), kind)
      await a.getByText(kind === 'generation' ? '지금은 AI Quiz 생성 기능을 사용할 수 없어요.' : '지금은 GPT Judge 평가 기능을 사용할 수 없어요.', { exact: true }).waitFor()
      const saved = await a.evaluate(() => window.readStored())
      const current = kind === 'generation' ? saved.generation : saved.judges['100']
      assert.equal(current.requestId, requestId)
      assert.equal(Object.values(current.pendingPosts).filter((status) => status === 'WAITING').length, 1)
    } finally { await context.close() }
  })
  test(`${kind}: 실제 응답 유실 후 읽기 실패에서도 R1을 재사용하고 삭제하지 않는다`, async () => {
    const page = await screen(kind)
    try {
      await send(page, kind)
      await page.waitForFunction(() => window.posts.length === 1)
      const firstId = await page.evaluate(() => window.posts[0].body.requestId)
      await page.evaluate(() => window.lose(0))
      if (kind === 'generation') {
        await page.getByText('요청 결과를 확인하지 못했어요. 같은 내용으로 다시 요청하면 중복 없이 이어서 확인해요.').waitFor()
        await page.getByRole('button', { name: '닫기', exact: true }).click()
        assert.equal(await page.getByRole('button', { name: '요청 지우기', exact: true }).count(), 0)
        assert.equal(await page.getByRole('button', { name: 'AI Quiz 만들기', exact: false }).isDisabled(), true)
      } else {
        await page.getByRole('button', { name: '평가 요청 다시 확인', exact: true }).waitFor()
      }
      await page.evaluate(() => { window.storageFailure.read = true; window.storageFailure.write = true })
      await send(page, kind, true)
      await page.waitForFunction(() => window.posts.length === 2)
      assert.equal(await page.evaluate(() => window.posts[1].body.requestId), firstId)
    } finally { await page.close() }
  })
  test(`${kind}: 늦은 R1 성공 응답은 다른 탭의 R2 작업 ID를 덮어쓰지 않는다`, async () => {
    const page = await screen(kind)
    try {
      await send(page, kind)
      await page.waitForFunction(() => window.posts.length === 1)
      const newer = jobs(kind, entry(kind, 2, 22))
      await page.evaluate((value) => window.storeOther(value), newer)
      await page.evaluate((kind) => window.reply(0, 202, kind === 'generation' ? { generationId: 11, status: 'PENDING' } : { evaluationId: 11, revisionId: 100, status: 'PENDING' }), kind)
      await page.waitForTimeout(100)
      assert.deepEqual(await page.evaluate(() => window.readStored()), newer)
    } finally { await page.close() }
  })
  test(`${kind}: 저장소 쓰기 실패 또는 예약 경쟁 시 신규 POST를 보내지 않는다`, async () => {
    for (const failure of ['write', 'reserveConflict']) {
      const page = await screen(kind)
      try {
        await page.evaluate(({ failure, value }) => { window.storageFailure[failure] = true; window.conflictingJobs = value }, { failure, value: jobs(kind, entry(kind, 2)) })
        await send(page, kind)
        await page.waitForTimeout(100)
        assert.equal(await page.evaluate(() => window.posts.length), 0, failure)
      } finally { await page.close() }
    }
  })
  test(`${kind}: 읽기 실패 후 미확인 R1 재시도는 같은 UUID를 보낸다`, async () => {
    const initial = jobs(kind, entry(kind, 1))
    const page = await screen(kind, initial)
    try {
      await page.waitForTimeout(50)
      await page.evaluate(() => { window.storageFailure.read = true })
      await send(page, kind, true)
      await page.waitForFunction(() => window.posts.length === 1)
      assert.equal(await page.evaluate(() => window.posts[0].body.requestId), uuid(1))
      await page.evaluate((kind) => window.reply(0, 202, kind === 'generation' ? { generationId: 11, status: 'PENDING' } : { evaluationId: 11, revisionId: 100, status: 'PENDING' }), kind)
      await page.waitForTimeout(100)
      // 응답 후에는 메모리에서 작업 ID로 이어 조회하며 신규 요청 버튼을 막는다.
      if (kind === 'generation') assert.equal(await page.getByRole('button', { name: 'AI Quiz 만들기', exact: false }).isDisabled(), true)
      else assert.equal(await page.getByRole('button', { name: '평가 요청', exact: true }).count(), 0)
    } finally { await page.close() }
  })
  test(`${kind}: 새 요청은 읽기 실패 또는 Web Lock 미지원이면 보내지 않는다`, async () => {
    for (const failure of ['read', 'lock', 'lockFailure']) {
      const page = await screen(kind)
      try {
        await page.evaluate((failure) => {
          if (failure === 'read') window.storageFailure.read = true
          else Object.defineProperty(navigator, 'locks', { value: failure === 'lock' ? undefined : { request: () => { throw Error('Lock unavailable') } } })
        }, failure)
        await send(page, kind)
        await page.waitForTimeout(100)
        assert.equal(await page.evaluate(() => window.posts.length), 0)
      } finally { await page.close() }
    }
  })
  for (const code of [kind === 'generation' ? 'QUIZ_GENERATION_IN_PROGRESS' : 'QUIZ_JUDGE_IN_PROGRESS', kind === 'generation' ? 'QUIZ_GENERATION_DISABLED' : 'QUIZ_JUDGE_DISABLED', 'NETWORK_ERROR']) {
    test(`${kind}: 오래된 ${code}는 최신 R2를 보존한다`, async () => {
      const page = await screen(kind)
      try {
        await send(page, kind)
        await page.waitForFunction(() => window.posts.length === 1)
        const newer = jobs(kind, entry(kind, 2, 22))
        await page.evaluate((value) => window.storeOther(value), newer)
        await page.evaluate((code) => code === 'NETWORK_ERROR' ? window.lose(0) : window.reply(0, code.endsWith('DISABLED') ? 503 : 409, null, code), code)
        await page.waitForTimeout(100)
        assert.deepEqual(await page.evaluate(() => window.readStored()), newer)
      } finally { await page.close() }
    })
  }
}
