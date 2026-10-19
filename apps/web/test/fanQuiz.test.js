import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@cking/shared/api'
import {
  QUIZ_PAGE_SIZE,
  appendQuizPage,
  classifySubmitError,
  QUIZ_PROGRESS_TTL_MS,
  quizListView,
  quizProgressKey,
  quizStep,
  restoreQuizAnswers,
  resumeStep,
  submitRequestFor,
} from '../src/utils/fanQuiz.js'

const quizzes = (from, count) => Array.from({ length: count }, (_, i) => ({ quizId: from + i, title: `Quiz ${from + i}` }))
const firstPage = (items, hasNext) => ({ items, page: 0, size: QUIZ_PAGE_SIZE, hasNext })
const ids = (view) => view.items.map((quiz) => quiz.quizId)

test('Quiz가 21개 이상이면 다음 페이지를 이어 붙이고 마지막 페이지에서 멈춘다', () => {
  const first = firstPage(quizzes(1, 20), true)
  let view = quizListView(first, null)
  assert.equal(view.items.length, 20)
  assert.equal(view.hasNext, true)
  assert.equal(view.nextPage, 1)

  const more = appendQuizPage(null, first, first, 1, { items: quizzes(21, 1), page: 1, hasNext: false })
  view = quizListView(first, more)
  assert.deepEqual(ids(view), quizzes(1, 21).map((quiz) => quiz.quizId))
  assert.equal(view.hasNext, false)
})

test('다음 페이지 요청이 실패하면 기존 목록을 유지하고 같은 페이지를 다시 요청한다', () => {
  const first = firstPage(quizzes(1, 20), true)
  // 실패한 요청은 more를 바꾸지 않는다.
  const view = quizListView(first, null)
  assert.equal(view.items.length, 20)
  assert.equal(view.nextPage, 1)

  const retried = appendQuizPage(null, first, first, view.nextPage, { items: quizzes(21, 5), hasNext: false })
  assert.equal(quizListView(first, retried).items.length, 25)
})

test('Creator가 바뀌면 이전 Creator의 이어 읽은 목록을 섞지 않는다', () => {
  const firstA = firstPage(quizzes(1, 20), true)
  const moreA = appendQuizPage(null, firstA, firstA, 1, { items: quizzes(21, 3), hasNext: false })
  const firstB = firstPage(quizzes(100, 2), false)

  assert.deepEqual(ids(quizListView(firstB, moreA)), [100, 101])
  // 이전 Creator에 보낸 요청이 늦게 도착해도 반영하지 않는다.
  const late = appendQuizPage(null, firstA, firstB, 1, { items: quizzes(21, 3), hasNext: false })
  assert.equal(late, null)
})

test('페이지 사이에 새 Quiz가 게시돼 겹친 항목은 한 번만 보여준다', () => {
  const first = firstPage(quizzes(1, 20), true)
  const more = appendQuizPage(null, first, first, 1, { items: quizzes(20, 3), hasNext: false })
  assert.deepEqual(ids(quizListView(first, more)), quizzes(1, 22).map((quiz) => quiz.quizId))
})

test('NETWORK_ERROR 뒤 같은 답안으로 다시 제출하면 같은 requestId를 쓴다', () => {
  let issued = 0
  const newRequestId = () => `request-${++issued}`
  const answers = [{ questionNo: 0, selectedOptionIndex: 1 }, { questionNo: 1, selectedOptionIndex: 0 }]

  const firstTry = submitRequestFor(null, answers, newRequestId)
  // 공통 전송 코드는 응답을 받지 못하면 ApiError('NETWORK_ERROR')를 던진다. 저장 여부를 모르므로 요청을 유지한다.
  assert.equal(classifySubmitError(new ApiError('NETWORK_ERROR', '네트워크 오류')), 'UNCERTAIN')
  const retry = submitRequestFor(firstTry, answers.map((answer) => ({ ...answer })), newRequestId)

  assert.equal(retry.requestId, firstTry.requestId)
  assert.equal(retry.key, firstTry.key)
  assert.equal(issued, 1)
})

test('답안을 바꾸면 새 requestId를 쓴다', () => {
  let issued = 0
  const newRequestId = () => `request-${++issued}`
  const firstTry = submitRequestFor(null, [{ questionNo: 0, selectedOptionIndex: 1 }], newRequestId)
  const changed = submitRequestFor(firstTry, [{ questionNo: 0, selectedOptionIndex: 2 }], newRequestId)

  assert.notEqual(changed.requestId, firstTry.requestId)
  assert.equal(issued, 2)
})

test('응답 수신이 불확실한 오류는 요청을 유지하고, 서버가 거절한 오류만 새 요청으로 넘어간다', () => {
  assert.equal(classifySubmitError(new TypeError('Failed to fetch')), 'UNCERTAIN')
  assert.equal(classifySubmitError(new ApiError('INTERNAL_ERROR', '서버 오류', 500)), 'UNCERTAIN')
  assert.equal(classifySubmitError(new ApiError(undefined, 'Bad Gateway', 502)), 'UNCERTAIN')
  assert.equal(classifySubmitError(new ApiError('VALIDATION_FAILED', '형식 오류', 400)), 'REJECTED')
  assert.equal(classifySubmitError(new ApiError('FORBIDDEN', '권한 없음', 403)), 'REJECTED')
})

test('409 응시 중복과 요청 충돌은 저장된 결과를 조회하고, 그 밖의 Quiz 오류는 코드대로 처리한다', () => {
  assert.equal(classifySubmitError(new ApiError('QUIZ_ALREADY_ATTEMPTED', '이미 응시', 409)), 'ALREADY_ATTEMPTED')
  assert.equal(classifySubmitError(new ApiError('QUIZ_ATTEMPT_REQUEST_CONFLICT', '요청 충돌', 409)), 'ALREADY_ATTEMPTED')
  assert.equal(classifySubmitError(new ApiError('QUIZ_PUBLISHED_REVISION_CHANGED', '변경', 409)), 'REVISION_CHANGED')
  assert.equal(classifySubmitError(new ApiError('QUIZ_NOT_FOUND', '없음', 404)), 'NOT_FOUND')
})

test('quizStep은 현재 문항 번호와 처음·마지막 여부를 알려준다', () => {
  assert.deepEqual(quizStep(0, 5), { index: 0, number: 1, total: 5, isFirst: true, isLast: false })
  assert.deepEqual(quizStep(2, 5), { index: 2, number: 3, total: 5, isFirst: false, isLast: false })
  assert.deepEqual(quizStep(4, 5), { index: 4, number: 5, total: 5, isFirst: false, isLast: true })
  assert.equal(quizStep(0, 1).isFirst && quizStep(0, 1).isLast, true)
})

test('quizStep은 범위를 벗어난 위치를 가까운 끝으로 맞추고 문항이 없으면 0으로 둔다', () => {
  assert.equal(quizStep(-1, 3).index, 0)
  assert.equal(quizStep(9, 3).index, 2)
  assert.equal(quizStep(undefined, 3).index, 0)
  assert.deepEqual(quizStep(0, 0), { index: 0, number: 0, total: 0, isFirst: true, isLast: true })
})

const progressQuestions = [0, 1, 2].map((questionNo) => ({
  questionNo,
  options: [0, 1, 2, 3].map((optionNo) => ({ optionNo, text: `보기 ${optionNo}` })),
}))
const NOW = 1_000_000_000_000

test('풀던 답안은 같은 revision일 때만 되살리고 이어 풀 문항으로 이동한다', () => {
  const saved = { revisionId: 7, answers: { 0: 2, 1: 0 }, savedAt: NOW - 1000 }
  const answers = restoreQuizAnswers(saved, 7, progressQuestions, NOW)
  assert.deepEqual(answers, { 0: 2, 1: 0 })
  assert.equal(resumeStep(progressQuestions, answers), 2)
  assert.equal(resumeStep(progressQuestions, { 0: 1, 1: 1, 2: 3 }), 2)
  assert.equal(restoreQuizAnswers(saved, 8, progressQuestions, NOW), null)
})

test('저장된 답안은 오래됐거나 현재 보기에 없으면 버리고 키에는 회원이 들어간다', () => {
  const old = { revisionId: 7, answers: { 0: 1 }, savedAt: NOW - QUIZ_PROGRESS_TTL_MS - 1 }
  assert.equal(restoreQuizAnswers(old, 7, progressQuestions, NOW), null)
  assert.equal(restoreQuizAnswers({ revisionId: 7, answers: { 0: 9 }, savedAt: NOW }, 7, progressQuestions, NOW), null)
  assert.equal(restoreQuizAnswers({ revisionId: 7, answers: { 0: 1, 5: 1 }, savedAt: NOW }, 7, progressQuestions, NOW)[5], undefined)
  assert.equal(restoreQuizAnswers(null, 7, progressQuestions, NOW), null)
  assert.notEqual(quizProgressKey(1, 2, 3), quizProgressKey(9, 2, 3))
})
