import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLICATION_LABELS } from '../src/components/creator/quizLabels.js'
import { canPublish, creatorQuizErrorMessage } from '../src/utils/quizJobs.js'
import { classifySubmitError } from '../src/utils/fanQuiz.js'

test('CLOSED는 마감 라벨이고 게시 포인터가 있어도 재게시할 수 없다', () => {
  assert.equal(PUBLICATION_LABELS.CLOSED?.label, '마감')
  assert.equal(canPublish({publicationStatus:'CLOSED',publishedRevisionId:100}, {revisionId:100,latest:true,reviewStatus:'APPROVED'}),false)
})
test('BE 마감 오류를 재게시 불가와 미게시 마감 불가로 안내한다', () => {
  assert.match(creatorQuizErrorMessage({code:'QUIZ_CLOSED'},'fallback'),/마감/)
  assert.match(creatorQuizErrorMessage({code:'QUIZ_CLOSE_NOT_ALLOWED'},'fallback'),/게시/)
})
test('팬의 QUIZ_CLOSED는 일반 재시도 오류와 구분한다', () => {
  assert.equal(classifySubmitError({code:'QUIZ_CLOSED',status:409}),'CLOSED')
})
