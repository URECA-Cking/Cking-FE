// 공개 TEMPORARY_ERROR는 두 내부 상태를 함께 표현한다.
// APPROVED + 보상 재시도는 reasonCode가 없고 자동 복구를 기다리며,
// FAILED는 항상 처리 실패 reasonCode를 가지므로 새 requestId 제출이 가능하다.
export function isSubscriptionRewardRecovery(verification) {
  return verification?.status === 'TEMPORARY_ERROR' && !verification.reasonCode
}

export function shouldPollSubscriptionVerification(verification) {
  return verification?.status === 'VERIFYING' || isSubscriptionRewardRecovery(verification)
}

export function canResubmitSubscriptionVerification(verification) {
  const status = verification?.status ?? null
  return status === null
    || status === 'REJECTED'
    || status === 'RETRY_REQUIRED'
    || (status === 'TEMPORARY_ERROR' && !isSubscriptionRewardRecovery(verification))
}

/** useAsync가 이전 data를 유지해도, 현재 Space 소유 Creator의 채널만 표시한다. */
export function isYoutubeChannelForCreator(channel, creatorId) {
  return channel?.creatorId === creatorId
}
