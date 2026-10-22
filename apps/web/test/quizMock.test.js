import test from 'node:test'
import assert from 'node:assert/strict'
import { findMyQuizAttempt, submitQuizAttempt } from '../src/dev/quizMock.js'

// 개발용 더미 API의 Fan 응시 판정이 BE(FanQuizAttemptService·QuizAttemptStore)의 멱등성 계약과 같은지 확인한다.

const NOW = Date.UTC(2026, 9, 13, 0, 0, 0)
const MEMBER = 900
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function stateWithQuiz() {
  const questions = [0, 1].map((questionNo) => ({
    questionNo,
    question: `문항 ${questionNo + 1}`,
    options: [0, 1, 2, 3].map((optionNo) => ({ optionNo, text: `보기 ${optionNo}` })),
    correctOptionIndex: questionNo,
    explanation: '해설',
    sourceEvidence: '근거',
  }))
  return {
    seq: 1000,
    quizzes: [{
      quizId: 1, creatorId: 10, videoId: 'dQw4w9WgXcQ', publicationStatus: 'PUBLISHED', publishedRevisionId: 100,
      revisions: [{ revisionId: 100, revisionNo: 1, title: '물의 순환', reviewStatus: 'APPROVED', questions }],
    }],
    attempts: [],
  }
}

const answers = [{ questionNo: 0, selectedOptionIndex: 0 }, { questionNo: 1, selectedOptionIndex: 2 }]
const submit = (state, body, extra = {}) => submitQuizAttempt(
  state,
  { memberId: MEMBER, myCreatorId: null, creatorId: 10, quizId: 1, body, ...extra },
  NOW,
)

test('같은 requestId·같은 답안의 재전송은 답안 순서가 달라도 저장된 결과를 그대로 돌려준다', () => {
  const state = stateWithQuiz()
  const first = submit(state, { requestId: uuid(1), revisionId: 100, answers })
  assert.equal(first.correctCount, 1)
  const replay = submit(state, { requestId: uuid(1), revisionId: 100, answers: [...answers].reverse() })
  assert.equal(replay.attemptId, first.attemptId)
  assert.equal(state.attempts.length, 1)
})

test('게시 취소 뒤에도 같은 요청의 재전송은 404가 아니라 저장된 결과를 돌려준다', () => {
  const state = stateWithQuiz()
  const first = submit(state, { requestId: uuid(1), revisionId: 100, answers })
  state.quizzes[0].publicationStatus = 'UNPUBLISHED'
  state.quizzes[0].publishedRevisionId = null
  assert.equal(submit(state, { requestId: uuid(1), revisionId: 100, answers }).attemptId, first.attemptId)
})

test('같은 requestId에 다른 답안이면 409 QUIZ_ATTEMPT_REQUEST_CONFLICT', () => {
  const state = stateWithQuiz()
  submit(state, { requestId: uuid(1), revisionId: 100, answers })
  const conflict = submit(state, { requestId: uuid(1), revisionId: 100, answers: [{ questionNo: 0, selectedOptionIndex: 1 }, answers[1]] })
  assert.deepEqual([conflict.status, conflict.code], [409, 'QUIZ_ATTEMPT_REQUEST_CONFLICT'])
})

test('이미 응시한 Quiz에 다른 requestId로 제출하면 게시 상태와 관계없이 409 QUIZ_ALREADY_ATTEMPTED', () => {
  const state = stateWithQuiz()
  submit(state, { requestId: uuid(1), revisionId: 100, answers })
  const again = submit(state, { requestId: uuid(2), revisionId: 100, answers })
  assert.deepEqual([again.status, again.code], [409, 'QUIZ_ALREADY_ATTEMPTED'])

  state.quizzes[0].publicationStatus = 'UNPUBLISHED'
  const afterUnpublish = submit(state, { requestId: uuid(3), revisionId: 100, answers })
  assert.deepEqual([afterUnpublish.status, afterUnpublish.code], [409, 'QUIZ_ALREADY_ATTEMPTED'])
})

test('신규 제출만 게시 상태·게시 revision·본인 Quiz·답안 형식을 검사한다', () => {
  const unpublished = stateWithQuiz()
  unpublished.quizzes[0].publicationStatus = 'UNPUBLISHED'
  const gone = submit(unpublished, { requestId: uuid(1), revisionId: 100, answers })
  assert.deepEqual([gone.status, gone.code], [404, 'QUIZ_NOT_FOUND'])

  const changed = submit(stateWithQuiz(), { requestId: uuid(1), revisionId: 99, answers })
  assert.deepEqual([changed.status, changed.code], [409, 'QUIZ_PUBLISHED_REVISION_CHANGED'])

  const own = submit(stateWithQuiz(), { requestId: uuid(1), revisionId: 100, answers }, { myCreatorId: 10 })
  assert.deepEqual([own.status, own.code], [403, 'FORBIDDEN'])

  const otherCreator = submit(stateWithQuiz(), { requestId: uuid(1), revisionId: 100, answers }, { creatorId: 11 })
  assert.deepEqual([otherCreator.status, otherCreator.code], [404, 'QUIZ_NOT_FOUND'])

  for (const body of [
    { requestId: 'not-uuid', revisionId: 100, answers },
    { requestId: uuid(1), revisionId: 100, answers: [] },
    { requestId: uuid(1), revisionId: 100, answers: [answers[0]] },
    { requestId: uuid(1), revisionId: 100, answers: [answers[0], { questionNo: 1, selectedOptionIndex: 4 }] },
    { requestId: uuid(1), revisionId: 100, answers: [answers[0], { questionNo: 2, selectedOptionIndex: 0 }] },
  ]) {
    const invalid = submit(stateWithQuiz(), body)
    assert.deepEqual([invalid.status, invalid.code], [400, 'VALIDATION_FAILED'], JSON.stringify(body))
  }
})

test('내 응시 결과는 기록이 없거나 creatorId 경로가 다르면 404 QUIZ_ATTEMPT_NOT_FOUND', () => {
  const state = stateWithQuiz()
  const missing = findMyQuizAttempt(state, { memberId: MEMBER, creatorId: 10, quizId: 1 }, NOW)
  assert.deepEqual([missing.status, missing.code], [404, 'QUIZ_ATTEMPT_NOT_FOUND'])

  const first = submit(state, { requestId: uuid(1), revisionId: 100, answers })
  assert.equal(findMyQuizAttempt(state, { memberId: MEMBER, creatorId: 10, quizId: 1 }, NOW).attemptId, first.attemptId)
  const wrongPath = findMyQuizAttempt(state, { memberId: MEMBER, creatorId: 11, quizId: 1 }, NOW)
  assert.deepEqual([wrongPath.status, wrongPath.code], [404, 'QUIZ_ATTEMPT_NOT_FOUND'])
})
