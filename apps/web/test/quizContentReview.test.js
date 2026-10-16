import test from 'node:test'
import assert from 'node:assert/strict'
import { isAwaitingContentReview, reviewDraftKey, readReviewDraft, saveReviewDraft, clearReviewDraft, validateReviewText } from '../src/utils/quizContentReview.js'
test('검토 대기는 RUNNING 단계만 인정한다', () => {
  assert.equal(isAwaitingContentReview({status:'RUNNING',reviewStage:'AWAITING_REVIEW'}), true)
  assert.equal(isAwaitingContentReview({status:'FAILED',reviewStage:'AWAITING_REVIEW'}), false)
  assert.equal(isAwaitingContentReview({status:'RUNNING'}), false)
})
test('원문을 바꾸지 않고 검증하며 UTF-16 길이와 공백을 검사한다', () => {
  assert.equal(validateReviewText('  원문\r\n ', 50000), null)
  assert.ok(validateReviewText(' \n'))
  assert.ok(validateReviewText('a'.repeat(50001)))
})
test('수정본은 Creator와 작업별 격리되며 불확실 원문도 보존한다', () => {
  const values=new Map(); const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
  assert.equal(saveReviewDraft(storage,7,1,{text:'  원문 ',pendingText:'  원문 '}),true)
  assert.equal(readReviewDraft(storage,7,1).pendingText,'  원문 ')
  assert.equal(readReviewDraft(storage,8,1),null); assert.equal(readReviewDraft(storage,7,2),null)
  clearReviewDraft(storage,7,1); assert.equal(readReviewDraft(storage,7,1),null)
  assert.notEqual(reviewDraftKey(7,1),reviewDraftKey(7,2))
})
test('저장소 실패나 손상된 기록은 생성 흐름을 중단하지 않는다', () => {
  const broken={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}}
  assert.equal(readReviewDraft(broken,7,1),null); assert.equal(saveReviewDraft(broken,7,1,{text:'x'}),false)
  assert.doesNotThrow(()=>clearReviewDraft(broken,7,1))
})
