import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// 상태 표시(StatusPill)는 아이콘 글자가 라벨 앞에 붙으므로 부분 일치로 찾는다.
// 승인 화면(QuizRevisionSheet)의 원문 수정 여부 표시. revision 상세의 contentEdited·contentConfirmedAt(BE #623)을 쓴다.
const confirmedAt = '2026-10-15T01:02:03.456Z'
const revision = (fields = {}) => ({
  quizId: 1, revisionId: 100, revisionNo: 1, latest: true, published: false, title: 'T', videoId: 'dQw4w9WgXcQ',
  promptVersion: 'quiz-mcq-v1', contentText: '물은 증발해 구름이 된다.', reviewStatus: 'PENDING_REVIEW',
  decisionReason: null, decidedAt: null, createdAt: '2026-10-12T00:00:00Z', origin: 'AI_GENERATED',
  hashVersion: 'quiz-revision-v1', revisionSha256: 'a'.repeat(64), canEdit: true, contentLocked: false,
  questionCount: 1, optionCount: 4,
  questions: [{ questionId: 1000, questionNo: 0, question: '문제', options: ['A', 'B', 'C', 'D'].map((text, optionNo) => ({ text, optionNo })),
    correctOptionIndex: 0, explanation: '해설', sourceEvidence: '근거' }],
  contentEdited: null, contentConfirmedAt: null,
  ...fields,
})

let bundle, browser
test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://quiz.test'), 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/quizCompositionBrowser.jsx', import.meta.url)), name: 'ContentReviewTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((item) => item.type === 'chunk').code
  const paths = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function sheet(fixture) {
  // 확정 시각 표시를 실행 환경과 무관하게 비교하도록 시간대를 고정한다.
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul', locale: 'ko-KR' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // 외부 통신은 전부 차단하고 실제 컴포넌트가 호출하는 fetch를 메모리 응답으로 받는다.
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/content-review-test')
  await page.evaluate((fixture) => {
    window.fixtureRevision = fixture
    window.posts = []
    window.fetch = (url, init = {}) => {
      if (init.method === 'POST') return new Promise(() => window.posts.push(String(url)))
      const data = String(url).includes('/revisions/')
        ? fixture
        : { quizId: 1, publicationStatus: 'NOT_PUBLISHED', revisions: [{ revisionId: 100, revisionNo: 1, title: 'T' }] }
      return Promise.resolve(new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 }))
    }
  }, fixture)
  await page.addScriptTag({ content: bundle })
  await page.evaluate(() => window.renderComposition('sheet'))
  await page.getByRole('region', { name: 'revision 정보', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  return { page, context }
}

const info = (page) => page.getByRole('region', { name: 'revision 정보', exact: true })

for (const [edited, label] of [[true, 'Creator가 수정한 원문'], [false, 'AI 원문 그대로 확정']]) {
  test(`contentEdited=${edited}이면 "${label}"과 확정 시각을 원문 위에 표시한다`, async () => {
    const { page, context } = await sheet(revision({ contentEdited: edited, contentConfirmedAt: confirmedAt }))
    try {
      await info(page).getByText(label, { exact: false }).waitFor()
      const time = await info(page).getByText('원문 확정', { exact: false }).textContent()
      assert.match(time, /26\.10\.15\./)
      assert.match(time, /10시 02분/)
      assert.equal(await info(page).getByText(edited ? 'AI 원문 그대로 확정' : 'Creator가 수정한 원문', { exact: false }).count(), 0)
      // 수정 여부는 원문 텍스트(<details>) 바로 위에 온다.
      const order = await info(page).evaluate((section, label) => {
        const pill = [...section.querySelectorAll('span')].find((node) => node.textContent.endsWith(label))
        return pill.compareDocumentPosition(section.querySelector('details'))
      }, label)
      assert.ok(order & 4)
    } finally { await context.close() }
  })
}

test('확정 시각이 없으면 수정 여부만 표시한다', async () => {
  const { page, context } = await sheet(revision({ contentEdited: true, contentConfirmedAt: null }))
  try {
    await info(page).getByText('Creator가 수정한 원문', { exact: false }).waitFor()
    assert.equal(await info(page).getByText('원문 확정', { exact: false }).count(), 0)
  } finally { await context.close() }
})

for (const [name, fields] of [['null', {}], ['undefined', { contentEdited: undefined, contentConfirmedAt: undefined }]]) {
  test(`contentEdited=${name}(원문 검토 없이 만든 Quiz)이면 표시하지 않고 기존 화면을 유지한다`, async () => {
    const { page, context } = await sheet(revision(fields))
    try {
      await info(page).getByText('분석한 원문 텍스트', { exact: true }).waitFor()
      for (const text of ['Creator가 수정한 원문', 'AI 원문 그대로 확정', '원문 확정']) {
        assert.equal(await page.getByText(text, { exact: false }).count(), 0)
      }
      // 기존 검토·평가·승인·편집 진입은 그대로다.
      await page.getByRole('region', { name: 'GPT Judge 평가', exact: true }).waitFor()
      await page.getByRole('region', { name: '승인과 반려', exact: true }).waitFor()
      await page.getByRole('button', { name: '최종 문항 선택·편집', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.posts.length), 0)
    } finally { await context.close() }
  })
}
