import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@cking/shared/api'
import {
  canApprove,
  canPublish,
  creatorQuizErrorMessage,
  generationInput,
  generationRequestFor,
  isUncertainError,
  judgeAction,
  judgeRequestFor,
  parseQuizJobs,
  parseYoutubeVideoId,
  quizJobsKey,
  readQuizJobs,
  updateQuizJobs,
  validateGenerationInput,
  withGeneration,
  withJudge,
} from '../src/utils/quizJobs.js'

const NOW = Date.UTC(2026, 9, 13, 0, 0, 0)
const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ids = () => {
  let issued = 0
  const next = () => uuid(++issued)
  next.count = () => issued
  return next
}

function memoryStorage() {
  const map = new Map()
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

const input = (overrides = {}) => generationInput({
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  title: '물의 순환',
  questionCount: 3,
  ...overrides,
})

test('BE가 받는 YouTube 주소 형식에서만 videoId를 꺼낸다', () => {
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ#t=10',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ/',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ/?feature=share',
    'https://www.youtube.com:443/watch?v=dQw4w9WgXcQ',
    '  https://youtu.be/dQw4w9WgXcQ?si=abc  ',
  ]) {
    assert.equal(parseYoutubeVideoId(url), 'dQw4w9WgXcQ', url)
  }
  for (const url of [
    'http://youtu.be/dQw4w9WgXcQ',
    'https://vimeo.com/dQw4w9WgXcQ',
    'https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ',
    'https://user@www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa',
    'https://www.youtube.com/watch?v=dQw4w9WgXc%51',
    'https://youtu.be/short',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    // BE는 Shorts에만 끝 슬래시 하나를 허용한다.
    'https://youtube.com/shorts/dQw4w9WgXcQ//',
    'https://youtube.com/shorts/dQw4w9WgXcQ/extra',
    'https://youtu.be/dQw4w9WgXcQ/',
    'https://www.youtube.com/watch/?v=dQw4w9WgXcQ',
    'not a url',
  ]) {
    assert.equal(parseYoutubeVideoId(url), null, url)
  }
})

test('생성 입력은 제목 공백·100자 초과·문항 수 3/5 외 값을 막는다', () => {
  assert.equal(validateGenerationInput(input()), null)
  assert.equal(validateGenerationInput(input({ title: 'a'.repeat(100) })), null)
  assert.match(validateGenerationInput(input({ title: 'a'.repeat(101) })), /100자/)
  assert.match(validateGenerationInput(input({ title: '   ' })), /제목/)
  assert.match(validateGenerationInput(input({ questionCount: 4 })), /3개 또는 5개/)
  assert.match(validateGenerationInput(input({ youtubeUrl: 'https://example.com' })), /YouTube/)
  assert.equal(input({ title: '  물의 순환 ' }).title, '물의 순환')
})

test('응답을 받지 못한 생성 요청은 같은 입력이면 같은 requestId로, 입력이 바뀌면 새 requestId로 보낸다', () => {
  const next = ids()
  const first = generationRequestFor(null, input(), next, NOW)
  // 주소 표현이 달라도 videoId·제목·문항 수가 같으면 BE는 같은 입력으로 본다.
  const retry = generationRequestFor(first, input({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), next, NOW + 1000)
  assert.equal(retry.requestId, first.requestId)
  // Shorts 주소의 끝 슬래시 유무도 같은 videoId라 같은 요청이다.
  const shorts = generationRequestFor(first, input({ youtubeUrl: 'https://youtube.com/shorts/dQw4w9WgXcQ/' }), next, NOW + 2000)
  assert.equal(shorts.requestId, first.requestId)
  assert.equal(next.count(), 1)

  assert.notEqual(generationRequestFor(first, input({ title: '다른 제목' }), next, NOW).requestId, first.requestId)
  assert.notEqual(generationRequestFor(first, input({ questionCount: 5 }), next, NOW).requestId, first.requestId)
})

test('작업 ID를 받은 생성 요청(실패 뒤 다시 만들기)은 같은 입력이어도 새 requestId를 쓴다', () => {
  const next = ids()
  const accepted = { ...generationRequestFor(null, input(), next, NOW), generationId: 7 }
  const again = generationRequestFor(accepted, input(), next, NOW)
  assert.notEqual(again.requestId, accepted.requestId)
  assert.equal(again.generationId, null)
})

test('평가 요청은 같은 대상의 응답 불확실 요청만 requestId를 재사용한다', () => {
  const next = ids()
  const first = judgeRequestFor(null, 1, 100, next, NOW)
  assert.equal(judgeRequestFor(first, 1, 100, next, NOW).requestId, first.requestId)
  assert.notEqual(judgeRequestFor(first, 1, 101, next, NOW).requestId, first.requestId)
  // FAILED·UNKNOWN 뒤 재평가는 새 requestId로만 할 수 있다.
  assert.notEqual(judgeRequestFor({ ...first, evaluationId: 40 }, 1, 100, next, NOW).requestId, first.requestId)
})

test('응답을 못 받았거나 5xx면 불확실, 4xx와 기능 꺼짐 503은 접수되지 않은 것으로 본다', () => {
  assert.equal(isUncertainError(new ApiError('NETWORK_ERROR', '연결 실패')), true)
  assert.equal(isUncertainError(new TypeError('Failed to fetch')), true)
  assert.equal(isUncertainError(new ApiError('INTERNAL_ERROR', '오류', 500)), true)
  assert.equal(isUncertainError(new ApiError(undefined, 'Bad Gateway', 502)), true)
  assert.equal(isUncertainError(new ApiError(undefined, 'Service Unavailable', 503)), true)

  assert.equal(isUncertainError(new ApiError('QUIZ_GENERATION_DISABLED', '꺼짐', 503)), false)
  assert.equal(isUncertainError(new ApiError('QUIZ_JUDGE_DISABLED', '꺼짐', 503)), false)
  assert.equal(isUncertainError(new ApiError('QUIZ_JUDGE_NOT_CONFIGURED', '설정 없음', 503)), false)
  assert.equal(isUncertainError(new ApiError('QUIZ_GENERATION_IN_PROGRESS', '진행 중', 409)), false)
  assert.equal(isUncertainError(new ApiError('QUIZ_GENERATION_REQUEST_CONFLICT', '충돌', 409)), false)
  assert.equal(isUncertainError(new ApiError('VALIDATION_FAILED', '형식', 400)), false)
  assert.equal(isUncertainError(new ApiError('FORBIDDEN', '권한', 403)), false)
})

test('계약의 오류 코드는 정해진 안내로, 연결 오류는 fallback으로 보여준다', () => {
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_GENERATION_IN_PROGRESS', 'x', 409), 'f'), /진행 중인 Quiz 생성/)
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_GENERATION_DISABLED', 'x', 503), 'f'), /생성 기능/)
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_JUDGE_DISABLED', 'x', 503), 'f'), /Judge 평가 기능/)
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_JUDGE_EVALUATION_REQUIRED', 'x', 409), 'f'), /ALL_PASS/)
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_REVISION_NOT_LATEST', 'x', 409), 'f'), /최신 revision/)
  assert.match(creatorQuizErrorMessage(new ApiError('QUIZ_REVISION_NOT_APPROVED', 'x', 409), 'f'), /승인한 revision/)
  assert.equal(creatorQuizErrorMessage(new ApiError('NETWORK_ERROR', '백엔드 서버에 연결할 수 없습니다.'), 'f'), 'f')
  assert.equal(creatorQuizErrorMessage(new TypeError('Failed to fetch'), 'f'), 'f')
  assert.equal(creatorQuizErrorMessage(new ApiError('VALIDATION_FAILED', '제목은 100자 이하', 400), 'f'), '제목은 100자 이하')
})

test('ALL_PASS인 이 revision의 SUCCEEDED 평가만 승인할 수 있다', () => {
  const revision = { revisionId: 100, reviewStatus: 'PENDING_REVIEW' }
  const evaluation = { evaluationId: 40, revisionId: 100, status: 'SUCCEEDED', aggregation: 'ALL_PASS', attempt: 1, maxAttempts: 2 }
  assert.equal(canApprove(revision, evaluation), true)
  assert.equal(canApprove(revision, { ...evaluation, aggregation: 'HAS_FAIL' }), false)
  assert.equal(canApprove(revision, { ...evaluation, aggregation: 'UNCERTAIN_ONLY' }), false)
  assert.equal(canApprove(revision, { ...evaluation, status: 'RUNNING', aggregation: null }), false)
  assert.equal(canApprove(revision, { ...evaluation, revisionId: 101 }), false)
  assert.equal(canApprove({ ...revision, reviewStatus: 'APPROVED' }, evaluation), false)
  assert.equal(canApprove(revision, null), false)
})

test('평가 버튼은 완료·진행 중에는 숨기고 기술적 실패는 남은 횟수가 있을 때만 다시 요청한다', () => {
  const revision = { revisionId: 100, reviewStatus: 'PENDING_REVIEW' }
  const job = (status, attempt = 1) => ({ revisionId: 100, status, attempt, maxAttempts: 2 })
  assert.equal(judgeAction(revision, null), 'REQUEST')
  assert.equal(judgeAction(revision, job('PENDING')), 'WAIT')
  assert.equal(judgeAction(revision, job('RUNNING')), 'WAIT')
  assert.equal(judgeAction(revision, { ...job('SUCCEEDED'), aggregation: 'HAS_FAIL' }), 'DONE')
  assert.equal(judgeAction(revision, job('FAILED', 1)), 'RETRY')
  assert.equal(judgeAction(revision, job('UNKNOWN', 1)), 'RETRY')
  assert.equal(judgeAction(revision, job('FAILED', 2)), 'EXHAUSTED')
  assert.equal(judgeAction({ ...revision, reviewStatus: 'REJECTED' }, null), 'DECIDED')
})

test('승인된 최신 revision만 게시하고, 같은 revision을 게시 중이면 다시 게시하지 않는다', () => {
  const revision = { revisionId: 100, latest: true, reviewStatus: 'APPROVED' }
  const quiz = { publicationStatus: 'NOT_PUBLISHED', publishedRevisionId: null }
  assert.equal(canPublish(quiz, revision), true)
  assert.equal(canPublish({ publicationStatus: 'UNPUBLISHED', publishedRevisionId: null }, revision), true)
  assert.equal(canPublish({ publicationStatus: 'PUBLISHED', publishedRevisionId: 100 }, revision), false)
  assert.equal(canPublish({ publicationStatus: 'PUBLISHED', publishedRevisionId: 99 }, revision), true)
  assert.equal(canPublish(quiz, { ...revision, latest: false }), false)
  assert.equal(canPublish(quiz, { ...revision, reviewStatus: 'PENDING_REVIEW' }), false)
})

test('생성·평가 요청을 Creator별로 저장하고 새로고침 뒤 그대로 복구한다', () => {
  const storage = memoryStorage()
  const next = ids()
  const generation = { ...generationRequestFor(null, input(), next, NOW), generationId: 7 }
  updateQuizJobs(storage, 10, withGeneration(generation), NOW)
  updateQuizJobs(storage, 10, withJudge(100, { quizId: 1, revisionId: 100, requestId: uuid(50), evaluationId: 40, savedAt: NOW }), NOW)

  const restored = readQuizJobs(storage, 10, NOW + HOUR)
  assert.deepEqual(restored.generation, generation)
  assert.equal(restored.judges['100'].evaluationId, 40)
  // 다른 Creator의 저장값과 섞이지 않는다.
  assert.equal(readQuizJobs(storage, 11, NOW).generation, null)
  assert.deepEqual(readQuizJobs(storage, 11, NOW).judges, {})
  // 저장값에는 요청 정보만 있고 토큰 같은 인증 정보는 없다.
  assert.doesNotMatch(storage.getItem(quizJobsKey(10)), /token|Bearer/i)
})

test('생성과 평가를 따로 고쳐도 서로의 저장값을 덮어쓰지 않고, 모두 지우면 저장 키를 없앤다', () => {
  const storage = memoryStorage()
  const next = ids()
  updateQuizJobs(storage, 10, withGeneration(generationRequestFor(null, input(), next, NOW)), NOW)
  updateQuizJobs(storage, 10, withJudge(100, { quizId: 1, revisionId: 100, requestId: uuid(50), evaluationId: null, savedAt: NOW }), NOW)
  updateQuizJobs(storage, 10, withGeneration(null), NOW)
  assert.equal(readQuizJobs(storage, 10, NOW).judges['100'].requestId, uuid(50))

  updateQuizJobs(storage, 10, withJudge(100, null), NOW)
  assert.equal(storage.map.has(quizJobsKey(10)), false)
})

test('깨졌거나 형식이 틀린 저장값은 버린다', () => {
  assert.deepEqual(parseQuizJobs('{not json', NOW), { generation: null, judges: {} })
  assert.deepEqual(parseQuizJobs('null', NOW), { generation: null, judges: {} })
  const broken = parseQuizJobs(JSON.stringify({
    generation: { requestId: 'not-a-uuid', input: { youtubeUrl: 'x', title: 't', questionCount: 3 }, generationId: null, savedAt: NOW },
    judges: {
      100: { quizId: 1, revisionId: 100, requestId: uuid(1), evaluationId: -1, savedAt: NOW },
      101: { quizId: '1', revisionId: 101, requestId: uuid(2), evaluationId: null, savedAt: NOW },
      102: { quizId: 1, revisionId: 102, requestId: uuid(3), evaluationId: 5, savedAt: NOW },
    },
  }), NOW)
  assert.equal(broken.generation, null)
  assert.deepEqual(Object.keys(broken.judges), ['102'])

  const badCount = parseQuizJobs(JSON.stringify({
    generation: { requestId: uuid(1), input: { youtubeUrl: 'x', title: 't', questionCount: 4 }, generationId: null, savedAt: NOW },
  }), NOW)
  assert.equal(badCount.generation, null)
})

test('오래된 저장값은 버린다: 작업 ID가 없으면 하루, 있으면 30일. 미래 시각도 버린다', () => {
  const pending = (savedAt) => ({ requestId: uuid(1), input: input(), generationId: null, savedAt })
  const tracked = (savedAt) => ({ ...pending(savedAt), generationId: 7 })
  const parse = (generation) => parseQuizJobs(JSON.stringify({ generation }), NOW).generation

  assert.notEqual(parse(pending(NOW - 23 * HOUR)), null)
  assert.equal(parse(pending(NOW - 25 * HOUR)), null)
  assert.notEqual(parse(tracked(NOW - 29 * DAY)), null)
  assert.equal(parse(tracked(NOW - 31 * DAY)), null)
  assert.equal(parse(pending(NOW + DAY)), null)
})

test('평가 저장값은 최근 20개까지만 둔다', () => {
  const judges = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [
    String(100 + i),
    { quizId: 1, revisionId: 100 + i, requestId: uuid(i + 1), evaluationId: i + 1, savedAt: NOW - (25 - i) * 1000 },
  ]))
  const kept = Object.keys(parseQuizJobs(JSON.stringify({ judges }), NOW).judges)
  assert.equal(kept.length, 20)
  assert.equal(kept.includes('100'), false)
  assert.equal(kept.includes('124'), true)
})

test('저장소를 쓸 수 없어도 바뀐 값을 돌려줘 이번 화면에서는 이어서 동작한다', () => {
  const failing = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: () => {},
  }
  const next = ids()
  const request = generationRequestFor(null, input(), next, NOW)
  assert.deepEqual(updateQuizJobs(failing, 10, withGeneration(request), NOW).generation, request)
  assert.deepEqual(readQuizJobs(failing, 10, NOW).generation, null)
  assert.deepEqual(updateQuizJobs(null, 10, withGeneration(request), NOW).generation, request)
})
