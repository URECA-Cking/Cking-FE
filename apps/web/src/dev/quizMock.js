// 개발 전용 AI Quiz 더미 API. mockApi.js가 ?mock=…일 때만 붙인다(배포 빌드에는 들어가지 않는다).
// 실제 BE·Gemini·OpenAI를 부르지 않고, 계약(Cking-BE docs/domains/quiz/api.md, judge-api.md, attempt-api.md)의
// 상태 전이·멱등성·오류 코드를 흉내 낸다. 상태는 sessionStorage에 둬서 새로고침 뒤 복구를 확인할 수 있다.
//
// 생성·평가는 요청 후 약 1.5초 PENDING, 4.5초까지 RUNNING, 그 뒤 결과가 정해진다. Quiz 제목에 아래 표시를 넣으면 상황을 만든다.
//   생성: [실패] FAILED · [모름] UNKNOWN · [꺼짐] 503 · [진행중] 409 · [응답유실] 첫 요청 응답 유실(작업은 생성) · [서버오류] 첫 요청 500(작업은 생성)
//   원문 검토: 제목에 [원문검토] 추가. [확정꺼짐]은 원문 확정만 503으로 거절하며 취소는 허용한다.
//   평가: [불통과] HAS_FAIL · [보류] UNCERTAIN_ONLY · [평가실패] 1회차 FAILED · [평가모름] 1회차 UNKNOWN · [평가꺼짐] 503 · [평가유실] 첫 요청 응답 유실

import { compositionBody } from '../utils/quizComposition.js'
import { parseYoutubeVideoId } from '../utils/quizJobs.js'

const STATE_KEY = 'cking.mock.quiz.v2'
const PENDING_MS = 1500
const RUNNING_MS = 4500
const LATENCY_MS = 400
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JUDGE_ITEMS = ['textAnswerCorrect', 'uniqueAnswer', 'evidenceSupportsAnswer', 'questionClarity', 'koreanQuality', 'distractorQuality', 'textFaithfulness']

const iso = (time) => (time === null || time === undefined ? null : new Date(time).toISOString())
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fail = (status, code, message = code) => ({ status, code, data: null, message })
const accepted = (data) => ({ status: 202, code: 'SUCCESS', data })

function buildQuestions(count, topic) {
  return Array.from({ length: count }, (_, i) => ({
    questionNo: i,
    question: `${topic} 영상에서 ${i + 1}번째로 설명한 내용은 무엇인가요?`,
    options: ['보기 A', '보기 B', '보기 C', '보기 D'].map((text, optionNo) => ({ optionNo, text: `${text} (${i + 1})` })),
    correctOptionIndex: i % 4,
    explanation: `영상 ${i + 1}번째 구간에서 보기 ${'ABCD'[i % 4]}를 설명합니다.`,
    sourceEvidence: `${i + 1}번째 구간: "보기 ${'ABCD'[i % 4]}가 맞습니다."`,
  }))
}

function seed(now) {
  const quiz = (quizId, creatorId, title, minutesAgo, published) => {
    const createdAt = now - minutesAgo * 60 * 1000
    return {
      quizId,
      creatorId,
      videoId: 'dQw4w9WgXcQ',
      contentText: `${title} 영상의 대본입니다. 물은 증발해 구름이 되고, 구름은 비가 되어 내립니다.`,
      createdAt,
      updatedAt: createdAt,
      publicationStatus: published ? 'PUBLISHED' : 'NOT_PUBLISHED',
      publishedRevisionId: published ? quizId * 100 : null,
      publishedAt: published ? createdAt + 60 * 1000 : null,
      unpublishedAt: null,
      revisions: [{
        revisionId: quizId * 100,
        revisionNo: 1,
        title,
        reviewStatus: published ? 'APPROVED' : 'PENDING_REVIEW',
        decisionReason: null,
        decidedAt: published ? createdAt + 30 * 1000 : null,
        createdAt,
        questions: buildQuestions(3, title),
      }],
    }
  }
  return {
    seq: 1000,
    quizzes: [
      quiz(1, 1, '물의 순환', 300, true),
      quiz(2, 1, '[불통과] 태양계 행성', 120, false),
      quiz(3, 2, '민준의 음악 Quiz', 200, true),
    ],
    generations: [],
    judges: [],
    attempts: [],
    lost: [],
  }
}

function load(now) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null')
    if (saved && Array.isArray(saved.quizzes)) return saved
  } catch {
    // 아래에서 새로 만든다.
  }
  return seed(now)
}

function store(state) {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // 저장하지 못하면 이번 로드에서만 유지된다.
  }
}

const has = (title, tag) => String(title ?? '').includes(tag)
const latestRevision = (quiz) => quiz.revisions[quiz.revisions.length - 1]
const findQuiz = (state, quizId) => state.quizzes.find((quiz) => quiz.quizId === Number(quizId))

function readBody(init) {
  try {
    return init?.body ? JSON.parse(init.body) : {}
  } catch {
    return {}
  }
}

/** 같은 Creator의 생성 작업을 시간에 따라 진행시킨다. 성공하면 Quiz와 revision을 만든다. */
function advanceGeneration(state, job, now) {
  if (!['PENDING', 'RUNNING'].includes(job.status)) return
  if (job.reviewStage === 'AWAITING_REVIEW') return
  if (job.reviewStage === 'GROUNDING' && now - job.requestedAt >= RUNNING_MS) {
    job.status = 'RUNNING'; job.reviewStage = 'AWAITING_REVIEW'
    job.aiContentText = `${job.title} 영상의 AI 분석 원문입니다. 물은 증발해 구름이 됩니다.`
    job.facts = [{fact:'물은 증발한다.',evidenceType:'SPEECH',evidence:'물이 증발합니다.',timestampStart:'00:01',timestampEnd:'00:03'}]
    return
  }
  const elapsed = now - (job.contentConfirmedAt ?? job.requestedAt)
  if (elapsed < PENDING_MS) return
  job.startedAt = job.startedAt ?? job.requestedAt + PENDING_MS
  if (elapsed < RUNNING_MS) {
    job.status = 'RUNNING'
    return
  }
  job.completedAt = (job.contentConfirmedAt ?? job.requestedAt) + RUNNING_MS
  if (has(job.title, '[실패]')) {
    job.status = 'FAILED'
    job.failureCode = 'GENERATION_INVALID'
  } else if (has(job.title, '[모름]')) {
    job.status = 'UNKNOWN'
    job.failureCode = 'PROVIDER_TIMEOUT'
  } else {
    const quizId = ++state.seq
    const revisionId = ++state.seq
    state.quizzes.push({
      quizId,
      creatorId: job.creatorId,
      videoId: job.videoId,
      contentText: job.reviewedContentText ?? `${job.title} 영상을 분석한 대본입니다. (더미)`,
      contentEdited: job.reviewedContentText == null ? null : job.reviewedContentText !== job.aiContentText,
      contentConfirmedAt: iso(job.contentConfirmedAt),
      createdAt: job.completedAt,
      updatedAt: job.completedAt,
      publicationStatus: 'NOT_PUBLISHED',
      publishedRevisionId: null,
      publishedAt: null,
      unpublishedAt: null,
      revisions: [{
        revisionId, revisionNo: 1, title: job.title, reviewStatus: 'PENDING_REVIEW', decisionReason: null, decidedAt: null,
        createdAt: job.completedAt, questions: buildQuestions(job.questionCount, job.title),
      }],
    })
    job.status = 'SUCCEEDED'
    job.quizId = quizId
    job.revisionId = revisionId
  }
}

function advanceJudge(state, job, now) {
  if (!['PENDING', 'RUNNING'].includes(job.status)) return
  const elapsed = now - job.requestedAt
  if (elapsed < PENDING_MS) return
  job.startedAt = job.startedAt ?? job.requestedAt + PENDING_MS
  if (elapsed < RUNNING_MS) {
    job.status = 'RUNNING'
    return
  }
  job.completedAt = job.requestedAt + RUNNING_MS
  const quiz = findQuiz(state, job.quizId)
  const revision = quiz.revisions.find((item) => item.revisionId === job.revisionId)
  const title = revision.title
  if (has(title, '[평가실패]') && job.attempt === 1) {
    job.status = 'FAILED'
    job.failureCode = 'PROVIDER_ERROR'
    return
  }
  if (has(title, '[평가모름]') && job.attempt === 1) {
    job.status = 'UNKNOWN'
    job.failureCode = 'PROVIDER_TIMEOUT'
    return
  }
  const odd = has(title, '[불통과]') ? 'fail' : has(title, '[보류]') ? 'uncertain' : null
  job.status = 'SUCCEEDED'
  job.resultId = job.evaluationId + 5000
  job.aggregation = odd === 'fail' ? 'HAS_FAIL' : odd === 'uncertain' ? 'UNCERTAIN_ONLY' : 'ALL_PASS'
  job.questions = revision.questions.map((question) => ({
    questionNo: question.questionNo,
    items: Object.fromEntries(JUDGE_ITEMS.map((key) => {
      const verdict = odd && question.questionNo === 0 && key === 'uniqueAnswer' ? odd : 'pass'
      const reason = verdict === 'pass' ? '기준을 만족합니다.' : verdict === 'fail' ? '정답이 될 수 있는 보기가 둘입니다.' : '원문만으로는 판단하기 어렵습니다.'
      return [key, { verdict, reason }]
    })),
  }))
}

const generationView = (job) => ({
  generationId: job.generationId, status: job.status, videoId: job.videoId, title: job.title,
  questionCount: job.questionCount, optionCount: 4, quizId: job.quizId ?? null, revisionId: job.revisionId ?? null,
  reviewStage: job.reviewStage ?? null, contentEdited: job.reviewedContentText == null ? null : job.reviewedContentText !== job.aiContentText, contentConfirmedAt: iso(job.contentConfirmedAt),
  failureCode: job.failureCode ?? null, requestedAt: iso(job.requestedAt), startedAt: iso(job.startedAt), completedAt: iso(job.completedAt),
})

const judgeView = (job) => ({
  evaluationId: job.evaluationId, quizId: job.quizId, revisionId: job.revisionId, status: job.status,
  attempt: job.attempt, maxAttempts: 2, failureCode: job.failureCode ?? null, resultId: job.resultId ?? null,
  aggregation: job.aggregation ?? null, requestedAt: iso(job.requestedAt), startedAt: iso(job.startedAt),
  completedAt: iso(job.completedAt), questions: job.status === 'SUCCEEDED' ? job.questions : [],
})

const quizSummary = (quiz) => {
  const latest = latestRevision(quiz)
  return {
    quizId: quiz.quizId, title: latest.title, publicationStatus: quiz.publicationStatus,
    publishedRevisionId: quiz.publishedRevisionId, latestRevisionId: latest.revisionId, latestRevisionNo: latest.revisionNo,
    latestReviewStatus: latest.reviewStatus, closedAt: iso(quiz.closedAt), publishedAt: iso(quiz.publishedAt), createdAt: iso(quiz.createdAt), updatedAt: iso(quiz.updatedAt),
  }
}

const publicationView = (quiz) => ({
  quizId: quiz.quizId, publicationStatus: quiz.publicationStatus, publishedRevisionId: quiz.publishedRevisionId,
  publishedAt: iso(quiz.publishedAt), unpublishedAt: iso(quiz.unpublishedAt), closedAt: iso(quiz.closedAt),
})

const pageOf = (items, url) => {
  const page = Number(url.searchParams.get('page') ?? 0)
  const size = Number(url.searchParams.get('size') ?? 20)
  const slice = items.slice(page * size, page * size + size)
  return { items: slice, page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size), hasNext: (page + 1) * size < items.length }
}

/**
 * mockApi.js의 routes에 이어 붙일 [method, pattern, handler] 목록.
 * myCreatorId는 로그인한 Creator(?mock=creator), Fan 시나리오면 null이다.
 */
export function quizMockRoutes({ myCreatorId, memberId }) {
  // 요청마다 저장값을 읽고 진행시킨 뒤 저장한다(다른 탭·새로고침과 같은 상태를 본다).
  let operation = Promise.resolve()
  const withState = handler => async (...args) => {
    await sleep(LATENCY_MS)
    const work = operation.then(async () => {
      const now = Date.now(), state = load(now)
      state.generations.forEach(job => advanceGeneration(state, job, now))
      state.judges.forEach(job => advanceJudge(state, job, now))
      await ensureCompositionMetadata(state)
      try {
        const result = await handler(state, now, ...args)
        return result?.code ? result : { status: 200, code: 'SUCCESS', data: result }
      } finally { store(state) }
    })
    operation = work.catch(() => {})
    return work
  }
  const creatorOnly = (handler) => withState((state, now, ...args) => (myCreatorId ? handler(state, now, ...args) : fail(403, 'FORBIDDEN', '이 기능을 사용할 권한이 없는 계정입니다.')))
  const myQuiz = (state, quizId) => {
    const quiz = findQuiz(state, quizId)
    if (!quiz) return { error: fail(404, 'QUIZ_NOT_FOUND', 'Quiz가 없습니다.') }
    if (quiz.creatorId !== myCreatorId) return { error: fail(403, 'FORBIDDEN') }
    return { quiz }
  }
  const myRevision = (state, quizId, revisionId) => {
    const { quiz, error } = myQuiz(state, quizId)
    if (error) return { error }
    const revision = quiz.revisions.find((item) => item.revisionId === Number(revisionId))
    return revision ? { quiz, revision } : { error: fail(404, 'QUIZ_REVISION_NOT_FOUND') }
  }

  return [
    // ---- Creator ----
    ['GET', /^\/api\/creator\/quizzes\/generations\/current$/, creatorOnly(state => {
      const job = state.generations.find(item => item.creatorId === myCreatorId && ['PENDING','RUNNING'].includes(item.status))
      if (!job) return { status:200, code:'SUCCESS' }
      return { ...generationView(job), content: job.reviewStage === 'AWAITING_REVIEW' ? {
        aiContentText:job.aiContentText, facts:job.facts, groundingModel:'gemini-mock', groundingPromptVersion:'quiz-grounding-v1', maxLength:50000,
      } : null }
    })],
    ['POST', /^\/api\/creator\/quizzes\/generations\/(\d+)\/(content-confirmation|cancel)$/, creatorOnly((state, now, id, action, url, init) => {
      const job = state.generations.find(item => item.generationId === Number(id))
      if (!job) return fail(404,'QUIZ_GENERATION_NOT_FOUND')
      if (job.creatorId !== myCreatorId) return fail(403,'FORBIDDEN')
      return reviewMockGeneration(job, action, readBody(init), now)
    })],

    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/revisions$/, creatorOnly((state, now, quizId, url, init) => composeMockRevision(state, myCreatorId, quizId, readBody(init), now))],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)\/creator-approval$/, creatorOnly((state, now, quizId, revisionId, url, init) => approveMockComposition(state, myCreatorId, quizId, revisionId, readBody(init), now))],
    ['GET', /^\/api\/creator\/quizzes$/, creatorOnly((state, now, url) => pageOf(
      state.quizzes.filter((quiz) => quiz.creatorId === myCreatorId)
        .sort((a, b) => b.createdAt - a.createdAt || b.quizId - a.quizId)
        .map(quizSummary),
      url,
    ))],
    ['POST', /^\/api\/creator\/quizzes\/generations$/, creatorOnly((state, now, url, init) => {
      const body = readBody(init)
      const videoId = parseYoutubeVideoId(body.youtubeUrl)
      const title = typeof body.title === 'string' ? body.title : ''
      const questionCount = body.questionCount ?? 3
      if (!UUID.test(body.requestId ?? '') || !videoId || !title.trim() || title.length > 100 || ![3, 5].includes(questionCount)) {
        return fail(400, 'VALIDATION_FAILED', '요청 값을 확인해 주세요.')
      }
      const existing = state.generations.find((job) => job.creatorId === myCreatorId && job.requestId === body.requestId)
      if (existing) {
        const same = existing.videoId === videoId && existing.title === title && existing.questionCount === questionCount
        return same ? accepted(generationView(existing)) : fail(409, 'QUIZ_GENERATION_REQUEST_CONFLICT', '같은 requestId로 다른 입력의 작업이 있습니다.')
      }
      if (has(title, '[꺼짐]')) return fail(503, 'QUIZ_GENERATION_DISABLED', 'Quiz 생성 기능이 꺼져 있습니다.')
      const active = state.generations.some((job) => job.creatorId === myCreatorId && ['PENDING', 'RUNNING'].includes(job.status))
      if (active || has(title, '[진행중]')) return fail(409, 'QUIZ_GENERATION_IN_PROGRESS', '진행 중인 생성 작업이 있습니다.')
      const job = { generationId: ++state.seq, creatorId: myCreatorId, requestId: body.requestId, videoId, title, questionCount, status: 'PENDING', requestedAt: now, reviewStage: has(title, '[원문검토]') ? 'GROUNDING' : null }
      state.generations.push(job)
      if (has(title, '[응답유실]') && !state.lost.includes(body.requestId)) {
        state.lost.push(body.requestId)
        throw new TypeError('Failed to fetch (mock: 응답 유실)')
      }
      if (has(title, '[서버오류]') && !state.lost.includes(body.requestId)) {
        state.lost.push(body.requestId)
        return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.')
      }
      return accepted(generationView(job))
    })],
    ['GET', /^\/api\/creator\/quizzes\/generations\/(\d+)$/, creatorOnly((state, now, id) => {
      const job = state.generations.find((item) => item.generationId === Number(id))
      if (!job) return fail(404, 'QUIZ_GENERATION_NOT_FOUND')
      if (job.creatorId !== myCreatorId) return fail(403, 'FORBIDDEN')
      return generationView(job)
    })],
    ['GET', /^\/api\/creator\/quizzes\/(\d+)$/, creatorOnly((state, now, quizId) => {
      const { quiz, error } = myQuiz(state, quizId)
      if (error) return error
      return {
        ...publicationView(quiz), creatorId: quiz.creatorId, videoId: quiz.videoId, createdAt: iso(quiz.createdAt), updatedAt: iso(quiz.updatedAt),
        origin: latestRevision(quiz).origin, parentRevisionId: latestRevision(quiz).parentRevisionId,
        hashVersion: latestRevision(quiz).hashVersion, approvalPolicyVersion: latestRevision(quiz).approvalPolicyVersion,
        contentLocked: quiz.contentLocked, canEdit: !quiz.contentLocked,
        revisions: quiz.revisions.map((revision) => ({
          revisionId: revision.revisionId, revisionNo: revision.revisionNo, title: revision.title, reviewStatus: revision.reviewStatus,
          decidedAt: iso(revision.decidedAt), createdAt: iso(revision.createdAt),
        })),
      }
    })],
    ['GET', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)$/, creatorOnly((state, now, quizId, revisionId) => {
      const { quiz, revision, error } = myRevision(state, quizId, revisionId)
      if (error) return error
      return compositionRevisionView(state, quiz, revision)
    })],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)\/judge-evaluations$/, creatorOnly((state, now, quizId, revisionId, url, init) => {
      const { quiz, revision, error } = myRevision(state, quizId, revisionId)
      if (error) return error
      const body = readBody(init)
      if (!UUID.test(body.requestId ?? '')) return fail(400, 'VALIDATION_FAILED', 'requestId가 필요합니다.')
      const existing = state.judges.find((job) => job.creatorId === myCreatorId && job.requestId === body.requestId)
      if (existing) {
        return existing.quizId === quiz.quizId && existing.revisionId === revision.revisionId
          ? accepted(judgeView(existing))
          : fail(409, 'QUIZ_JUDGE_REQUEST_CONFLICT', '같은 requestId로 다른 대상 요청이 있습니다.')
      }
      if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
      if (revision.reviewStatus === 'APPROVED') return fail(409, 'QUIZ_JUDGE_REVISION_APPROVED')
      const series = state.judges.filter((job) => job.revisionId === revision.revisionId)
      if (series.some((job) => job.status === 'SUCCEEDED')) return fail(409, 'QUIZ_JUDGE_EVALUATION_COMPLETED')
      if (has(revision.title, '[평가꺼짐]')) return fail(503, 'QUIZ_JUDGE_DISABLED', 'Judge 기능이 꺼져 있습니다.')
      if (state.judges.some((job) => job.creatorId === myCreatorId && ['PENDING', 'RUNNING'].includes(job.status))) {
        return fail(409, 'QUIZ_JUDGE_IN_PROGRESS')
      }
      if (series.length >= 2) return fail(409, 'QUIZ_JUDGE_ATTEMPT_LIMIT_REACHED')
      const job = {
        evaluationId: ++state.seq, creatorId: myCreatorId, quizId: quiz.quizId, revisionId: revision.revisionId,
        requestId: body.requestId, attempt: series.length + 1, status: 'PENDING', requestedAt: now,
      }
      state.judges.push(job)
      if (has(revision.title, '[평가유실]') && !state.lost.includes(body.requestId)) {
        state.lost.push(body.requestId)
        throw new TypeError('Failed to fetch (mock: 응답 유실)')
      }
      return accepted(judgeView(job))
    })],
    ['GET', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)\/judge-evaluations\/(\d+)$/, creatorOnly((state, now, quizId, revisionId, evaluationId) => {
      const { error } = myRevision(state, quizId, revisionId)
      if (error) return error
      const job = state.judges.find((item) => item.evaluationId === Number(evaluationId) && item.revisionId === Number(revisionId))
      return job ? judgeView(job) : fail(404, 'QUIZ_JUDGE_EVALUATION_NOT_FOUND')
    })],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)\/approve$/, creatorOnly((state, now, quizId, revisionId) => {
      const { quiz, revision, error } = myRevision(state, quizId, revisionId)
      if (error) return error
      if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
      if (revision.origin === 'CREATOR_COMPOSED') return fail(409, 'QUIZ_REVISION_CONFLICT')
      if (revision.reviewStatus === 'REJECTED') return fail(409, 'QUIZ_REVISION_ALREADY_DECIDED')
      if (revision.reviewStatus === 'PENDING_REVIEW') {
        const passed = state.judges.some((job) => job.revisionId === revision.revisionId && job.status === 'SUCCEEDED' && job.aggregation === 'ALL_PASS')
        if (!passed) return fail(409, 'QUIZ_JUDGE_EVALUATION_REQUIRED')
        revision.approvalPolicyVersion = 'LEGACY_JUDGE_V1'
        revision.reviewStatus = 'APPROVED'
        revision.decidedAt = now
        quiz.updatedAt = now
      }
      return { quizId: quiz.quizId, revisionId: revision.revisionId, reviewStatus: revision.reviewStatus, reason: null, decidedAt: iso(revision.decidedAt) }
    })],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/revisions\/(\d+)\/reject$/, creatorOnly((state, now, quizId, revisionId, url, init) => {
      const { quiz, revision, error } = myRevision(state, quizId, revisionId)
      if (error) return error
      if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
      const reason = readBody(init).reason
      if (typeof reason === 'string' && reason.length > 500) return fail(400, 'VALIDATION_FAILED', '사유는 500자 이하입니다.')
      if (revision.reviewStatus === 'APPROVED') return fail(409, 'QUIZ_REVISION_ALREADY_DECIDED')
      if (revision.reviewStatus === 'PENDING_REVIEW') {
        revision.reviewStatus = 'REJECTED'
        revision.decisionReason = reason?.trim() ? reason : null
        revision.decidedAt = now
        quiz.updatedAt = now
      }
      return { quizId: quiz.quizId, revisionId: revision.revisionId, reviewStatus: revision.reviewStatus, reason: revision.decisionReason, decidedAt: iso(revision.decidedAt) }
    })],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/publish$/, creatorOnly((state, now, quizId, url, init) => {
      const { quiz, error } = myQuiz(state, quizId)
      if (error) return error
      if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
      const revisionId = Number(readBody(init).revisionId)
      const revision = quiz.revisions.find((item) => item.revisionId === revisionId)
      if (!revisionId) return fail(400, 'VALIDATION_FAILED', 'revisionId가 필요합니다.')
      if (!revision) return fail(404, 'QUIZ_REVISION_NOT_FOUND')
      if (quiz.contentLocked && quiz.lockedRevisionId !== revisionId) return fail(409, 'QUIZ_CONTENT_LOCKED')
      if (latestRevision(quiz).revisionId !== revisionId) return fail(409, 'QUIZ_REVISION_NOT_LATEST')
      if (revision.reviewStatus !== 'APPROVED') return fail(409, 'QUIZ_REVISION_NOT_APPROVED')
      if (!(quiz.publicationStatus === 'PUBLISHED' && quiz.publishedRevisionId === revisionId)) {
        quiz.contentLocked = true
        quiz.lockedRevisionId = revisionId
        quiz.publicationStatus = 'PUBLISHED'
        quiz.publishedRevisionId = revisionId
        quiz.publishedAt = now
        quiz.unpublishedAt = null
        quiz.updatedAt = now
      }
      return publicationView(quiz)
    })],
    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/unpublish$/, creatorOnly((state, now, quizId) => {
      const { quiz, error } = myQuiz(state, quizId)
      if (error) return error
      if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
      if (quiz.publicationStatus === 'PUBLISHED') {
        quiz.publicationStatus = 'UNPUBLISHED'
        quiz.publishedRevisionId = null
        quiz.unpublishedAt = now
        quiz.updatedAt = now
      }
      return publicationView(quiz)
    })],

    ['POST', /^\/api\/creator\/quizzes\/(\d+)\/close$/, creatorOnly((state, now, quizId) => {
      const { quiz, error } = myQuiz(state, quizId)
      if (error) return error
      if (quiz.publicationStatus === 'NOT_PUBLISHED') return fail(409, 'QUIZ_CLOSE_NOT_ALLOWED')
      if (quiz.publicationStatus !== 'CLOSED') {
        quiz.publicationStatus = 'CLOSED'
        quiz.closedAt = now
        quiz.updatedAt = now
      }
      return publicationView(quiz)
    })],

    // ---- Fan(공개 조회·응시) ----
    ['GET', /^\/api\/creators\/(\d+)\/quizzes$/, withState((state, now, creatorId, url) => pageOf(
      state.quizzes.filter((quiz) => quiz.creatorId === Number(creatorId) && quiz.publicationStatus === 'PUBLISHED')
        .sort((a, b) => b.publishedAt - a.publishedAt || b.quizId - a.quizId)
        .map((quiz) => {
          const revision = quiz.revisions.find((item) => item.revisionId === quiz.publishedRevisionId)
          return { quizId: quiz.quizId, revisionId: revision.revisionId, title: revision.title, questionCount: revision.questions.length, publishedAt: iso(quiz.publishedAt) }
        }),
      url,
    ))],
    ['GET', /^\/api\/creators\/(\d+)\/quizzes\/(\d+)$/, withState((state, now, creatorId, quizId) => {
      const quiz = findQuiz(state, quizId)
      if (!quiz || quiz.creatorId !== Number(creatorId) || quiz.publicationStatus !== 'PUBLISHED') return fail(404, 'QUIZ_NOT_FOUND')
      const revision = quiz.revisions.find((item) => item.revisionId === quiz.publishedRevisionId)
      return {
        quizId: quiz.quizId, creatorId: quiz.creatorId, revisionId: revision.revisionId, videoId: quiz.videoId, title: revision.title,
        publishedAt: iso(quiz.publishedAt),
        questions: revision.questions.map(({ questionNo, question, options }) => ({ questionNo, question, options })),
      }
    })],
    ['POST', /^\/api\/creators\/(\d+)\/quizzes\/(\d+)\/attempts$/, withState((state, now, creatorId, quizId, url, init) => (
      submitQuizAttempt(state, { memberId, myCreatorId, creatorId: Number(creatorId), quizId: Number(quizId), body: readBody(init) }, now)
    ))],
    ['GET', /^\/api\/creators\/(\d+)\/quizzes\/(\d+)\/my-attempt$/, withState((state, now, creatorId, quizId) => (
      findMyQuizAttempt(state, { memberId, creatorId: Number(creatorId), quizId: Number(quizId) }, now)
    ))],
  ]
}

// 응시 6초 뒤에는 지급 완료로 바꿔 지급 상태 재조회를 확인한다. BE처럼 응답할 때마다 지급 상태를 채운다.
function withPaymentStatus(entry, now) {
  const reward = entry.result.reward
  if (reward.paymentStatus === 'PENDING' && now - Date.parse(entry.result.submittedAt) > 6000) reward.paymentStatus = 'PAID'
  return entry.result
}

/**
 * Fan 답안 제출(POST .../attempts). BE FanQuizAttemptService·QuizAttemptStore와 같은 순서로 판정한다.
 * 1. 같은 Member·requestId의 기존 응시가 있으면 요청 지문(Member·Creator·Quiz·revision·questionNo 순 답안)이 같을 때 저장된
 *    결과를 그대로 돌려주고(게시 취소·revision 교체 뒤에도), 다르면 409 QUIZ_ATTEMPT_REQUEST_CONFLICT
 * 2. 다른 requestId로 이미 응시한 Quiz면 409 QUIZ_ALREADY_ATTEMPTED
 * 3. 그다음에야 신규 제출로 Quiz 소유·본인 Quiz·게시 상태·게시 revision·답안 수를 검사한다
 */
export function submitQuizAttempt(state, { memberId, myCreatorId, creatorId, quizId, body }, now) {
  const answers = Array.isArray(body?.answers) ? [...body.answers].sort((a, b) => a?.questionNo - b?.questionNo) : []
  const invalidAnswer = (answer, index) => answer?.questionNo !== index
    || !Number.isInteger(answer.selectedOptionIndex) || answer.selectedOptionIndex < 0
  if (!UUID.test(body?.requestId ?? '') || !Number.isSafeInteger(body?.revisionId) || body.revisionId <= 0
    || answers.length === 0 || answers.some(invalidAnswer)) {
    return fail(400, 'VALIDATION_FAILED', '요청 값을 확인해 주세요.')
  }
  const fingerprint = JSON.stringify([memberId, creatorId, quizId, body.revisionId, answers.map((a) => [a.questionNo, a.selectedOptionIndex])])

  const byRequest = state.attempts.find((entry) => entry.memberId === memberId && entry.requestId === body.requestId)
  if (byRequest) {
    return byRequest.fingerprint === fingerprint
      ? withPaymentStatus(byRequest, now)
      : fail(409, 'QUIZ_ATTEMPT_REQUEST_CONFLICT', '같은 requestId로 다른 응시 요청이 있습니다.')
  }
  if (state.attempts.some((entry) => entry.memberId === memberId && entry.quizId === quizId)) {
    return fail(409, 'QUIZ_ALREADY_ATTEMPTED', '이미 응시한 Quiz입니다.')
  }

  const quiz = findQuiz(state, quizId)
  if (!quiz || quiz.creatorId !== creatorId) return fail(404, 'QUIZ_NOT_FOUND', 'Quiz를 찾을 수 없습니다.')
  if (quiz.creatorId === myCreatorId) return fail(403, 'FORBIDDEN', '이 기능을 사용할 권한이 없는 계정입니다.')
  if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
  if (quiz.publicationStatus !== 'PUBLISHED') return fail(404, 'QUIZ_NOT_FOUND', 'Quiz를 찾을 수 없습니다.')
  if (quiz.publishedRevisionId !== body.revisionId) return fail(409, 'QUIZ_PUBLISHED_REVISION_CHANGED', '게시된 revision이 변경됐습니다.')
  const revision = quiz.revisions.find((item) => item.revisionId === body.revisionId)
  if (answers.length !== revision.questions.length) return fail(400, 'VALIDATION_FAILED', '요청 값을 확인해 주세요.')
  if (answers.some((answer, i) => answer.selectedOptionIndex >= revision.questions[i].options.length)) {
    return fail(400, 'VALIDATION_FAILED', '요청 값을 확인해 주세요.')
  }

  const questions = revision.questions.map((question, i) => ({
    questionNo: question.questionNo, question: question.question, options: question.options.map((option) => option.text),
    selectedOptionIndex: answers[i].selectedOptionIndex, correctOptionIndex: question.correctOptionIndex,
    correct: answers[i].selectedOptionIndex === question.correctOptionIndex,
    explanation: question.explanation, sourceEvidence: question.sourceEvidence,
  }))
  const correctCount = questions.filter((question) => question.correct).length
  const result = {
    attemptId: ++state.seq, requestId: body.requestId, creatorId, quizId, revisionId: revision.revisionId,
    title: revision.title, videoId: quiz.videoId, questionCount: questions.length, correctCount, submittedAt: iso(now), questions,
    reward: { amount: correctCount, requestId: null, status: correctCount ? 'NOT_INTEGRATED' : 'NOT_ELIGIBLE', paymentStatus: correctCount ? 'PENDING' : 'NOT_ELIGIBLE' },
  }
  state.attempts.push({ memberId, requestId: body.requestId, fingerprint, creatorId, quizId, result })
  return result
}

/** 본인 응시 결과(GET .../my-attempt). 기록이 없거나 creatorId 경로가 다르면 404 QUIZ_ATTEMPT_NOT_FOUND. */
export function findMyQuizAttempt(state, { memberId, creatorId, quizId }, now) {
  const entry = state.attempts.find((item) => item.memberId === memberId && item.quizId === quizId)
  if (!entry || entry.creatorId !== creatorId) return fail(404, 'QUIZ_ATTEMPT_NOT_FOUND', '응시 기록을 찾을 수 없습니다.')
  return withPaymentStatus(entry, now)
}

// 문항 구성 Mock도 BE와 같은 길이 접두어와 SHA-256 Revision 계약을 사용한다.
const hashField = value => { const s = String(value); return `${new TextEncoder().encode(s).length}:${s}` }
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('')
async function mockRevisionHash(quiz, revision, parent = null) {
  const contentHash = await sha256(quiz.contentText ?? '')
  const fields = [parent ? 'quiz-revision-v2' : 'quiz-revision-v1', contentHash, revision.title, revision.promptVersion ?? 'quiz-mcq-v1']
  if (parent) fields.push(parent.revisionId, parent.revisionSha256)
  fields.push(revision.questions.length)
  for (const q of revision.questions) {
    if (parent) fields.push(q.changeType, q.originQuestionId ?? '', q.previousQuestionId ?? '')
    fields.push(q.question, q.options.length, ...q.options.map(o => o.text), q.correctOptionIndex, q.explanation, q.sourceEvidence)
  }
  return sha256(fields.map(hashField).join(''))
}
export async function ensureCompositionMetadata(state) {
  state.compositions ??= []
  for (const quiz of state.quizzes) {
    quiz.contentLocked ??= quiz.publicationStatus === 'PUBLISHED' || quiz.publicationStatus === 'UNPUBLISHED' || !!quiz.publishedAt
    quiz.lockedRevisionId ??= quiz.contentLocked ? quiz.publishedRevisionId ?? null : null
    for (const revision of quiz.revisions) {
      revision.origin ??= 'AI_GENERATED'; revision.hashVersion ??= 'quiz-revision-v1'; revision.parentRevisionId ??= null
      revision.questions.forEach((q, i) => { q.questionId ??= revision.revisionId * 10 + i; q.changeType ??= null; q.originQuestionId ??= null; q.previousQuestionId ??= null })
      revision.revisionSha256 ??= await mockRevisionHash(quiz, revision)
      revision.approvalPolicyVersion ??= revision.reviewStatus === 'APPROVED' ? 'LEGACY_JUDGE_V1' : null
    }
  }
  state.seq = Math.max(state.seq, ...state.quizzes.flatMap(q => q.revisions.flatMap(r => r.questions.map(item => item.questionId))))
}
export function compositionRevisionView(state, quiz, revision) {
  const latest = latestRevision(quiz).revisionId === revision.revisionId
  return { quizId: quiz.quizId, revisionId: revision.revisionId, revisionNo: revision.revisionNo, latest,
    published: quiz.publicationStatus === 'PUBLISHED' && quiz.publishedRevisionId === revision.revisionId,
    title: revision.title, videoId: quiz.videoId, promptVersion: revision.promptVersion ?? 'quiz-mcq-v1', contentText: quiz.contentText,
    contentEdited: quiz.contentEdited ?? null, contentConfirmedAt: quiz.contentConfirmedAt ?? null,
    reviewStatus: revision.reviewStatus, decisionReason: revision.decisionReason ?? null, decidedAt: iso(revision.decidedAt), createdAt: iso(revision.createdAt),
    origin: revision.origin, parentRevisionId: revision.parentRevisionId, hashVersion: revision.hashVersion, revisionSha256: revision.revisionSha256,
    approvalPolicyVersion: revision.approvalPolicyVersion ?? null, contentLocked: quiz.contentLocked, canEdit: latest && !quiz.contentLocked,
    questionCount: revision.questions.length, optionCount: revision.questions[0]?.options.length ?? 4,
    questions: revision.questions.map(q => {
      const originId = q.changeType === null ? q.questionId : q.originQuestionId
      const source = quiz.revisions.find(r => r.questions.some(o => o.questionId === originId))
      const original = source?.questions.find(o => o.questionId === originId)
      const job = (state.judges ?? []).find(j => j.revisionId === source?.revisionId && j.status === 'SUCCEEDED')
      const judged = job?.questions.find(item => item.questionNo === original.questionNo)
      const items = Object.values(judged?.items ?? {})
      const sourceEvaluation = judged ? { resultId: job.resultId, resultSha256: job.resultSha256 ?? 'a'.repeat(64), revisionId: source.revisionId, questionNo: original.questionNo, items: judged.items } : null
      const evaluationStatus = q.changeType === 'CREATOR_ADDED' ? 'NOT_EVALUATED' : q.editedHistory || q.changeType === 'CREATOR_EDITED' ? 'NOT_REVALIDATED'
        : !judged ? 'NOT_EVALUATED' : items.some(i => i.verdict === 'fail') ? 'FAIL' : items.some(i => i.verdict === 'uncertain') ? 'UNCERTAIN' : 'PASS'
      return { ...q, originQuestionId: originId, evaluationStatus, sourceEvaluation }
    }),
  }
}
export async function composeMockRevision(state, creatorId, quizId, body, now) {
  const quiz = findQuiz(state, quizId)
  if (!quiz) return fail(404, 'QUIZ_NOT_FOUND')
  if (quiz.creatorId !== creatorId) return fail(403, 'FORBIDDEN')
  if (!UUID.test(body.requestId ?? '')) return fail(400, 'VALIDATION_FAILED')
  const parent = quiz.revisions.find(r => r.revisionId === body.baseRevisionId)
  if (!parent) return fail(404, 'QUIZ_REVISION_NOT_FOUND')
  let normalized
  try {
    const draft = body.questions.map((q, i) => {
      const original = parent.questions.find(o => o.questionId === q.sourceQuestionId)
      if (q.sourceQuestionId && !original) throw Error('source')
      if (!q.sourceQuestionId && !q.content) throw Error('content')
      return { id: String(i), sourceQuestionId: q.sourceQuestionId, selected: true, edited: !!q.content,
        ...(q.content ?? { ...original, options: original.options.map(o => o.text) }) }
    })
    normalized = compositionBodyForMock(parent, body, draft)
  } catch { return fail(400, 'VALIDATION_FAILED') }
  const fingerprint = JSON.stringify(normalized)
  const previous = (state.compositions ?? []).find(r => r.quizId === quiz.quizId && r.requestId === body.requestId)
  if (previous) return previous.fingerprint === fingerprint
    ? { status: 200, code: 'SUCCESS', data: compositionRevisionView(state, quiz, quiz.revisions.find(r => r.revisionId === previous.revisionId)) }
    : fail(409, 'QUIZ_EDIT_REQUEST_CONFLICT')
  if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
  if (quiz.contentLocked) return fail(409, 'QUIZ_CONTENT_LOCKED')
  if (latestRevision(quiz).revisionId !== parent.revisionId || parent.revisionSha256 !== body.baseRevisionSha256) return fail(409, 'QUIZ_REVISION_CONFLICT')
  const revision = { revisionId: ++state.seq, revisionNo: parent.revisionNo + 1, title: parent.title, promptVersion: parent.promptVersion ?? 'quiz-mcq-v1', origin: 'CREATOR_COMPOSED', hashVersion: 'quiz-revision-v2', parentRevisionId: parent.revisionId, reviewStatus: 'PENDING_REVIEW', createdAt: now,
    questions: normalized.questions.map((selection, questionNo) => {
      const prior = parent.questions.find(q => q.questionId === selection.sourceQuestionId)
      const content = selection.content ?? { question: prior.question, options: prior.options.map(o => o.text), correctOptionIndex: prior.correctOptionIndex, explanation: prior.explanation, sourceEvidence: prior.sourceEvidence }
      const originId = prior ? prior.changeType === null ? prior.questionId : prior.originQuestionId : null
      const original = originId ? quiz.revisions.flatMap(r => r.questions).find(q => q.questionId === originId) : null
      const same = original && JSON.stringify([content.question, content.options, content.correctOptionIndex, content.explanation, content.sourceEvidence]) === JSON.stringify([original.question, original.options.map(o => o.text), original.correctOptionIndex, original.explanation, original.sourceEvidence])
      const changeType = !originId ? 'CREATOR_ADDED' : same ? 'AI_UNCHANGED' : 'CREATOR_EDITED'
      return { ...content, questionId: ++state.seq, questionNo, options: content.options.map((text, optionNo) => ({ text, optionNo })), changeType,
        originQuestionId: originId, previousQuestionId: prior?.questionId ?? null, editedHistory: !!prior?.editedHistory || prior?.changeType === 'CREATOR_EDITED' || changeType === 'CREATOR_EDITED' }
    }) }
  revision.revisionSha256 = await mockRevisionHash(quiz, revision, parent)
  quiz.revisions.push(revision); quiz.updatedAt = now
  state.compositions ??= []; state.compositions.push({ quizId: quiz.quizId, requestId: body.requestId, fingerprint, revisionId: revision.revisionId })
  return { status: 201, code: 'SUCCESS', data: compositionRevisionView(state, quiz, revision) }
}
function compositionBodyForMock(parent, body, draft) {
  return compositionBody({ ...parent, revisionSha256: body.baseRevisionSha256 }, draft)
}
export function approveMockComposition(state, creatorId, quizId, revisionId, body, now) {
  const quiz = findQuiz(state, quizId)
  if (!quiz) return fail(404, 'QUIZ_NOT_FOUND')
  if (quiz.creatorId !== creatorId) return fail(403, 'FORBIDDEN')
  if (quiz.publicationStatus === 'CLOSED') return fail(409, 'QUIZ_CLOSED')
  if (body.acknowledgeResponsibility !== true || !/^[a-f0-9]{64}$/.test(body.revisionSha256 ?? '')) return fail(400, 'VALIDATION_FAILED')
  const r = quiz.revisions.find(item => item.revisionId === Number(revisionId))
  if (!r) return fail(404, 'QUIZ_REVISION_NOT_FOUND')
  if (r.origin !== 'CREATOR_COMPOSED' || r.revisionSha256 !== body.revisionSha256) return fail(409, 'QUIZ_REVISION_CONFLICT')
  if (r.reviewStatus !== 'PENDING_REVIEW') {
    if (r.reviewStatus !== 'APPROVED' || r.approvalPolicyVersion !== 'CREATOR_REVIEW_V1') return fail(409, 'QUIZ_REVISION_ALREADY_DECIDED')
  } else {
    if (quiz.contentLocked) return fail(409, 'QUIZ_CONTENT_LOCKED')
    if (latestRevision(quiz).revisionId !== r.revisionId) return fail(409, 'QUIZ_REVISION_CONFLICT')
    r.reviewStatus = 'APPROVED'; r.approvalPolicyVersion = 'CREATOR_REVIEW_V1'; r.decidedAt = now; quiz.updatedAt = now
  }
  return { status: 200, code: 'SUCCESS', data: { quizId: quiz.quizId, revisionId: r.revisionId, reviewStatus: r.reviewStatus, reason: null, decidedAt: iso(r.decidedAt) } }
}

/** #615의 확정·취소 계약. 테스트에서도 같은 라우팅 함수를 사용한다. */
export function reviewMockGeneration(job, action, body, now) {
  if (action === 'cancel') {
    if (job.failureCode === 'CANCELLED') return generationView(job)
    if (job.status !== 'RUNNING' || job.reviewStage !== 'AWAITING_REVIEW') return fail(409, 'QUIZ_GENERATION_NOT_AWAITING_REVIEW')
    job.status='FAILED'; job.failureCode='CANCELLED'; job.completedAt=now
    return generationView(job)
  }
  const text=body.contentText
  if(typeof text !== 'string' || !text.trim() || text.length > 50000) return fail(400,'VALIDATION_FAILED')
  if(job.reviewedContentText != null) return text === job.reviewedContentText ? accepted(generationView(job)) : fail(409,'QUIZ_GENERATION_CONTENT_CONFLICT')
  if(has(job.title,'[확정꺼짐]')) return fail(503,'QUIZ_GENERATION_DISABLED')
  if(job.status !== 'RUNNING' || job.reviewStage !== 'AWAITING_REVIEW') return fail(409,'QUIZ_GENERATION_NOT_AWAITING_REVIEW')
  job.reviewedContentText=text; job.contentConfirmedAt=now; job.reviewStage='GENERATING'
  return accepted(generationView(job))
}
