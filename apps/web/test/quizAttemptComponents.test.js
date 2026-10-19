import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

// 팬 Quiz 응시 화면(전체 화면, 한 문항씩, 임시 저장, 모달 접근성)을 실제 React 화면으로 검증한다.
let browser, bundle
const pageErrors = []

test.before(async () => {
  const out = await build({
    configFile: false,
    plugins: [react()],
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://quiz.test'), 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/quizAttemptBrowser.jsx', import.meta.url)), name: 'AttemptTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(out) ? out[0] : out).output.find((x) => x.type === 'chunk').code
  const paths = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => {
  await browser?.close()
  assert.deepEqual(pageErrors, [])
})

async function screen(props = {}) {
  const page = await browser.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/*', (r) => (r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : r.abort()))
  await page.goto('http://localhost/attempt')
  await page.evaluate(() => {
    localStorage.clear()
    window.calls = []
    window.toasts = []
    window.logins = 0
    window.submitMode = 'ok'
    const questions = [0, 1, 2].map((questionNo) => ({
      questionId: 1000 + questionNo,
      questionNo,
      question: `질문 ${questionNo + 1}`,
      options: [0, 1, 2, 3].map((optionNo) => ({ optionNo, text: `보기 ${questionNo + 1}-${optionNo}` })),
    }))
    const response = (data, status = 200, code = 'SUCCESS') => new Response(JSON.stringify({ code, data }), { status })
    window.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname
      const method = options.method ?? 'GET'
      window.calls.push({ path, method, body: options.body })
      if (method === 'POST' && path.endsWith('/attempts')) {
        if (window.submitMode === 'network') throw TypeError('Failed to fetch')
        const body = JSON.parse(options.body)
        return response({
          attemptId: 1, title: '팬 Quiz', questionCount: 3, correctCount: 2, submittedAt: '2026-10-19T01:00:00Z',
          questions: questions.map((q) => ({
            questionNo: q.questionNo, question: q.question, options: q.options.map((o) => o.text),
            selectedOptionIndex: body.answers[q.questionNo].selectedOptionIndex, correctOptionIndex: 0, explanation: '해설',
          })),
          reward: { amount: 2, requestId: null, status: 'NOT_ELIGIBLE', paymentStatus: 'NOT_ELIGIBLE' },
        })
      }
      if (path.endsWith('/my-attempt')) return response(null, 404, 'QUIZ_ATTEMPT_NOT_FOUND')
      if (path === '/api/creators/10/quizzes') return response({ items: [{ quizId: 1, title: '팬 Quiz', questionCount: 3 }], hasNext: false, page: 0 })
      if (path === '/api/creators/10/quizzes/1') return response({ quizId: 1, title: '팬 Quiz', revisionId: 100, questions })
      throw Error(path)
    }
  })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((p) => window.renderAttempt(p), props)
  return page
}

const attempts = (page) => page.evaluate(() => window.calls.filter((c) => c.method === 'POST').map((c) => ({ ...JSON.parse(c.body) })))
// 아이콘 글자가 접근 가능한 이름에 섞이므로 보이는 텍스트로 찾는다.
const option = (page, text) => page.getByRole('button').filter({ hasText: text })
const heading = (page, text) => page.getByRole('heading', { name: text, exact: true })
const back = (page) => page.getByRole('button').filter({ hasText: '이전' })
const closeButton = (page) => page.getByRole('button', { name: '닫기', exact: true })
const listItem = (page) => page.getByRole('button').filter({ hasText: '팬 Quiz' })
const openQuiz = async (page) => {
  await listItem(page).click()
  await heading(page, '질문 1').waitFor()
}
const pick = async (page, no, optionNo, next) => {
  await option(page, `보기 ${no}-${optionNo}`).click()
  if (next) await heading(page, next).waitFor()
}

test('보기를 고르면 다음 문항으로 넘어가고, 이전 문항의 답을 바꿔 제출할 수 있다', async () => {
  const p = await screen()
  try {
    await openQuiz(p)
    await p.getByText('1 / 3', { exact: true }).waitFor()
    assert.equal(await back(p).count(), 0)
    await pick(p, 1, 1, '질문 2')
    await p.getByText('2 / 3', { exact: true }).waitFor()
    await back(p).click()
    await heading(p, '질문 1').waitFor()
    assert.equal(await option(p, '보기 1-1').getAttribute('aria-pressed'), 'true')
    await pick(p, 1, 2, '질문 2')
    await pick(p, 2, 0, '질문 3')
    assert.equal((await attempts(p)).length, 0)
    await pick(p, 3, 3)
    await p.getByText('내 점수', { exact: true }).waitFor()
    const posts = await attempts(p)
    assert.equal(posts.length, 1)
    assert.deepEqual(posts[0].answers, [
      { questionNo: 0, selectedOptionIndex: 2 },
      { questionNo: 1, selectedOptionIndex: 0 },
      { questionNo: 2, selectedOptionIndex: 3 },
    ])
    assert.equal(posts[0].revisionId, 100)
  } finally { await p.close() }
})

test('마지막 문항을 연타해도 제출 요청은 한 번만 나간다', async () => {
  const p = await screen()
  try {
    await openQuiz(p)
    await pick(p, 1, 0, '질문 2')
    await pick(p, 2, 0, '질문 3')
    await option(p, '보기 3-1').evaluate((el) => { el.click(); el.click() })
    await p.getByText('내 점수', { exact: true }).waitFor()
    assert.equal((await attempts(p)).length, 1)
  } finally { await p.close() }
})

test('비로그인은 마지막 문항을 골라도 제출하지 않고 로그인으로 보낸다', async () => {
  const p = await screen({ authenticated: false, memberId: null })
  try {
    await openQuiz(p)
    await pick(p, 1, 0, '질문 2')
    await pick(p, 2, 0, '질문 3')
    await pick(p, 3, 0)
    assert.equal((await attempts(p)).length, 0)
    assert.equal(await p.evaluate(() => window.logins), 0)
    await p.getByRole('button', { name: '로그인하고 제출하기', exact: true }).click()
    assert.equal(await p.evaluate(() => window.logins), 1)
    assert.equal((await attempts(p)).length, 0)
  } finally { await p.close() }
})

test('네트워크 오류 뒤 같은 답안은 같은 requestId로 다시 보내고 답안이 바뀌면 새 requestId를 쓴다', async () => {
  const p = await screen()
  try {
    await openQuiz(p)
    await p.evaluate(() => { window.submitMode = 'network' })
    await pick(p, 1, 0, '질문 2')
    await pick(p, 2, 0, '질문 3')
    await pick(p, 3, 0)
    await p.waitForFunction(() => window.toasts.length === 1)
    await p.getByRole('button', { name: '제출하기', exact: true }).click()
    await p.waitForFunction(() => window.toasts.length === 2)
    let posts = await attempts(p)
    assert.equal(posts.length, 2)
    assert.equal(posts[1].requestId, posts[0].requestId)
    assert.deepEqual(posts[1].answers, posts[0].answers)

    await back(p).click()
    await back(p).click()
    await pick(p, 1, 3, '질문 2')
    await pick(p, 2, 0, '질문 3')
    await p.getByRole('button', { name: '제출하기', exact: true }).click()
    await p.waitForFunction(() => window.toasts.length === 3)
    posts = await attempts(p)
    assert.equal(posts.length, 3)
    assert.notEqual(posts[2].requestId, posts[0].requestId)

    await p.evaluate(() => { window.submitMode = 'ok' })
    await p.getByRole('button', { name: '제출하기', exact: true }).click()
    await p.getByText('내 점수', { exact: true }).waitFor()
    posts = await attempts(p)
    assert.equal(posts[3].requestId, posts[2].requestId)
  } finally { await p.close() }
})

test('닫았다 다시 열면 푼 답을 이어서 보여주고 회원이 바뀌면 분리하며 제출하면 지운다', async () => {
  const p = await screen({ memberId: 1 })
  try {
    await openQuiz(p)
    await pick(p, 1, 1, '질문 2')
    await pick(p, 2, 2, '질문 3')
    await closeButton(p).click()
    await p.getByRole('dialog').waitFor({ state: 'detached' })

    await listItem(p).click()
    await heading(p, '질문 3').waitFor()
    await back(p).click()
    assert.equal(await option(p, '보기 2-2').getAttribute('aria-pressed'), 'true')
    await back(p).click()
    assert.equal(await option(p, '보기 1-1').getAttribute('aria-pressed'), 'true')
    await closeButton(p).click()

    // 다른 회원은 이 브라우저에 저장된 답을 보지 못한다.
    await p.evaluate(() => window.renderAttempt({ memberId: 2 }))
    await listItem(p).click()
    await heading(p, '질문 1').waitFor()
    assert.equal(await option(p, '보기 1-1').getAttribute('aria-pressed'), 'false')
    await closeButton(p).click()

    // 원래 회원으로 돌아오면 이어지고, 제출하면 저장분이 사라진다.
    await p.evaluate(() => window.renderAttempt({ memberId: 1 }))
    await listItem(p).click()
    await heading(p, '질문 3').waitFor()
    await pick(p, 3, 0)
    await p.getByText('내 점수', { exact: true }).waitFor()
    assert.equal(await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cking.quizProgress')).length), 0)
  } finally { await p.close() }
})

test('응시 모달은 초점을 안에 가두고 Escape로 닫으면 열었던 버튼으로 초점이 돌아간다', async () => {
  const p = await screen()
  try {
    const opener = listItem(p)
    await opener.focus()
    await opener.click()
    await heading(p, '질문 1').waitFor()
    const inside = () => p.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))
    assert.equal(await inside(), true)
    for (let i = 0; i < 8; i += 1) {
      await p.keyboard.press('Tab')
      assert.equal(await inside(), true)
    }
    for (let i = 0; i < 8; i += 1) {
      await p.keyboard.press('Shift+Tab')
      assert.equal(await inside(), true)
    }
    // 보기를 눌러 문항이 바뀌어도 초점이 모달 밖으로 나가지 않는다.
    await pick(p, 1, 0, '질문 2')
    assert.equal(await inside(), true)
    await p.keyboard.press('Escape')
    await p.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await p.evaluate(() => document.activeElement?.textContent.includes('팬 Quiz')), true)
  } finally { await p.close() }
})
