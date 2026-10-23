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

/**
 * 활동명을 설정하지 않은 Creator가 공개 활동(댓글 작성·수정, 게시글·이벤트 생성·수정, 이벤트 승인 요청, 이벤트 응모)을 하면 BE가 이 코드(409)로 막는다.
 * 기존 게시글·이벤트의 조회와 삭제는 막지 않는다.
 */
export const ACTIVITY_NAME_SETUP_REQUIRED = 'ACTIVITY_NAME_SETUP_REQUIRED'

/** ApiError(throw된 오류)와 envelope({ code })를 모두 받는다. */
export function isActivityNameSetupRequired(error) {
  return error?.code === ACTIVITY_NAME_SETUP_REQUIRED
}

/** 활동명 저장 오류 코드별 문구. 모르는 코드는 공통 문구나 대체 문구로 대신한다. */
export const ACTIVITY_NAME_ERROR_MESSAGES = {
  ACTIVITY_NAME_ALREADY_TAKEN: '이미 다른 크리에이터가 쓰고 있는 활동명이에요. 다른 이름을 입력해주세요.',
  ACTIVITY_NAME_CHANGE_TOO_SOON: '활동명은 마지막으로 바꾼 뒤 14일이 지나야 다시 바꿀 수 있어요.',
  VALIDATION_FAILED: '활동명은 1~20자이고 한글·영문·숫자·_·-만 쓸 수 있어요.',
  [ACTIVITY_NAME_SETUP_REQUIRED]: '먼저 활동명을 설정해주세요. 스페이스 편집에서 정할 수 있어요.',
}

/**
 * 크리에이터의 공개 활동(게시글·이벤트 작성·승인 요청)이 활동명 미설정으로 막혔을 때만 안내 문구로 바꾸고, 다른 오류는 공통 문구나 대체 문구로 보여 준다.
 * describeActivityNameError는 활동명 저장 화면용이라 VALIDATION_FAILED 같은 코드를 활동명 규칙 문구로 바꾸므로 여기서 쓰면 안 된다.
 */
export function describeCreatorWriteError(error, fallback) {
  if (isActivityNameSetupRequired(error)) return ACTIVITY_NAME_ERROR_MESSAGES[ACTIVITY_NAME_SETUP_REQUIRED]
  return describeError(error, fallback)
}

export function describeActivityNameError(error, fallback = '활동명을 저장하지 못했어요.') {
  if (error instanceof ApiError && ACTIVITY_NAME_ERROR_MESSAGES[error.code]) return ACTIVITY_NAME_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}
