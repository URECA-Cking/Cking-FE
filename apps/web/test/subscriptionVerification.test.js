import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canResubmitSubscriptionVerification,
  isSubscriptionRewardRecovery,
  isYoutubeChannelForCreator,
  shouldPollSubscriptionVerification,
} from '../src/utils/subscriptionVerificationState.js'

test('보상 재시도 TEMPORARY_ERROR는 상태 복구까지 계속 조회하고 재제출하지 않는다', () => {
  const verification = { status: 'TEMPORARY_ERROR', reasonCode: null }

  assert.equal(isSubscriptionRewardRecovery(verification), true)
  assert.equal(shouldPollSubscriptionVerification(verification), true)
  assert.equal(canResubmitSubscriptionVerification(verification), false)
})

test('처리 최종 실패 TEMPORARY_ERROR는 새 이미지 제출을 허용한다', () => {
  const verification = { status: 'TEMPORARY_ERROR', reasonCode: 'PROCESSING_ATTEMPTS_EXHAUSTED' }

  assert.equal(isSubscriptionRewardRecovery(verification), false)
  assert.equal(shouldPollSubscriptionVerification(verification), false)
  assert.equal(canResubmitSubscriptionVerification(verification), true)
})

test('VERIFYING은 조회를 유지하고 REJECTED와 RETRY_REQUIRED는 재제출을 허용한다', () => {
  assert.equal(shouldPollSubscriptionVerification({ status: 'VERIFYING' }), true)
  assert.equal(canResubmitSubscriptionVerification({ status: 'REJECTED' }), true)
  assert.equal(canResubmitSubscriptionVerification({ status: 'RETRY_REQUIRED' }), true)
})

test('이전 Creator의 채널 응답은 현재 Space에 표시하지 않는다', () => {
  const creatorAChannel = { creatorId: 10, channelHandle: '@creator-a' }

  assert.equal(isYoutubeChannelForCreator(creatorAChannel, 10), true)
  assert.equal(isYoutubeChannelForCreator(creatorAChannel, 20), false)
})
