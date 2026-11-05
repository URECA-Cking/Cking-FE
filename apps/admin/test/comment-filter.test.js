import test from 'node:test'
import assert from 'node:assert/strict'
import { filterReasonLabel, filterReasonSummary, isFilterRecheckPending } from '../src/utils/commentFilter.js'

test('필터링 사유는 세부 항목을 아는 코드를 먼저 풀어 쓴다', () => {
  assert.equal(filterReasonLabel('spam:link'), '링크')
  assert.equal(filterReasonLabel('privacy:phone'), '전화번호')
})

test('유형 코드는 유형 문구로 보여주고 두 모델 코드는 같은 문구다', () => {
  assert.equal(filterReasonLabel('classifier'), 'AI 판단')
  assert.equal(filterReasonLabel('model'), 'AI 판단')
  assert.equal(filterReasonLabel('profanity'), '욕설')
  assert.equal(filterReasonLabel('privacy'), '개인정보')
  assert.equal(filterReasonLabel('spam'), '스팸')
})

test('모르는 세부 항목은 유형 문구로, 모르는 유형은 기타로 보여준다', () => {
  assert.equal(filterReasonLabel('spam:new_rule'), '스팸')
  assert.equal(filterReasonLabel('invalid'), '기타')
  assert.equal(filterReasonLabel('new_type:rule'), '기타')
})

test('사유 목록은 같은 문구를 합치고 비어 있으면 대시다', () => {
  assert.equal(filterReasonSummary(['profanity', 'spam:link']), '욕설 · 링크')
  assert.equal(filterReasonSummary(['profanity', 'profanity']), '욕설')
  assert.equal(filterReasonSummary(['model', 'classifier']), 'AI 판단')
  assert.equal(filterReasonSummary([]), '-')
  assert.equal(filterReasonSummary(undefined), '-')
})

test('판정이 끝나지 않은 상태만 다시 확인 중으로 본다', () => {
  assert.equal(isFilterRecheckPending('PENDING'), true)
  assert.equal(isFilterRecheckPending('FAILED'), true)
  assert.equal(isFilterRecheckPending('DONE'), false)
  assert.equal(isFilterRecheckPending(undefined), false)
})
