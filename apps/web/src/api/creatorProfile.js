import { ApiError, apiClient, describeError } from './client.js'

// Creator 활동명 API(Cking-BE #520, docs/domains/creator/space-api.md).
// 응답: { creatorId, activityName, activityNameConfigured, activityNameChangeableAt(UTC), restorableActivityName }

/** GET /api/creator/profile - 내 활동명과 설정·변경 가능 상태. */
export function getMyCreatorProfile() {
  return apiClient.get('/api/creator/profile')
}

/**
 * PUT /api/creator/profile - 활동명을 전체 교체한다. 최초 설정은 즉시, 이후 변경은 14일 간격이며
 * 예약 기간 안의 이전 활동명으로는 언제든 되돌릴 수 있다. 응답은 GET과 같다.
 */
export function updateMyActivityName(activityName) {
  return apiClient.put('/api/creator/profile', { activityName })
}

/** 활동명을 설정하지 않은 Creator가 게시글·이벤트를 만들면 BE가 이 코드(409)로 막는다. */
export const ACTIVITY_NAME_SETUP_REQUIRED = 'ACTIVITY_NAME_SETUP_REQUIRED'

/** ApiError(throw된 오류)와 envelope({ code })를 모두 받는다. */
export function isActivityNameSetupRequired(error) {
  return error?.code === ACTIVITY_NAME_SETUP_REQUIRED
}

/** 활동명 저장 오류 코드별 문구. 모르는 코드는 서버 메시지나 상태 코드로 대신한다. */
export const ACTIVITY_NAME_ERROR_MESSAGES = {
  ACTIVITY_NAME_ALREADY_TAKEN: '이미 다른 크리에이터가 쓰고 있는 활동명이에요. 다른 이름을 입력해주세요.',
  ACTIVITY_NAME_CHANGE_TOO_SOON: '활동명은 마지막으로 바꾼 뒤 14일이 지나야 다시 바꿀 수 있어요.',
  VALIDATION_FAILED: '활동명은 1~20자이고 한글·영문·숫자·_·-만 쓸 수 있어요.',
  [ACTIVITY_NAME_SETUP_REQUIRED]: '먼저 활동명을 설정해주세요.',
}

export function describeActivityNameError(error, fallback = '활동명을 저장하지 못했어요.') {
  if (error instanceof ApiError && ACTIVITY_NAME_ERROR_MESSAGES[error.code]) return ACTIVITY_NAME_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}
