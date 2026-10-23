import { ApiError } from '@cking/shared/api'

// 화면에 보여 줄 오류 문구. 서버 message는 개발용이라 화면에 쓰지 않고 FE가 정한 문구만 보여 준다.
// 문구 순서: 화면별 코드 표 → 아래 공통 표 → 화면별 대체 문구.

export const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다.'
export const LOAD_ERROR_MESSAGE = '정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'

/**
 * 화면과 관계없이 같은 안내가 맞는 코드. 사용자가 다르게 행동해야 하는 코드만 둔다.
 * 요청 ID 충돌·동시 명령 충돌·SYSTEM_ERROR처럼 사용자가 할 수 있는 일이 없는 코드는 화면별 대체 문구로 처리한다.
 */
export const COMMON_ERROR_MESSAGES = {
  NETWORK_ERROR: '연결이 불안정해요. 잠시 후 다시 시도해주세요.',
  UNAUTHORIZED: '로그인이 필요해요. 다시 로그인해주세요.',
  FORBIDDEN: '이 기능을 사용할 권한이 없는 계정입니다.',
  UPLOAD_TOO_LARGE: '파일이 너무 커요. 5MB 이하로 올려주세요.',
  IMAGE_PROCESSING_BUSY: '지금 이미지를 처리하는 요청이 많아요. 잠시 뒤에 다시 시도해주세요.',
  PROFILE_SETUP_REQUIRED: '먼저 닉네임을 설정해주세요.',
  ACTIVITY_NAME_SETUP_REQUIRED: '먼저 활동명을 설정해주세요. 스페이스 편집에서 정할 수 있어요.',
  COMMENT_RESTRICTED: '댓글 작성이 제한되어 있어요.',
  SPACE_COMMENT_BLOCKED: '이 스페이스에서는 댓글을 쓸 수 없어요. 다른 스페이스에서는 쓸 수 있어요.',
  POST_FOLLOWERS_ONLY: '팬에게만 공개된 게시글이에요.',
  SELF_FOLLOW_NOT_ALLOWED: '내 스페이스에는 도킹할 수 없어요.',
  DUPLICATE_MISSION: '이미 완료한 미션이에요.',
  MISSION_INACTIVE: '지금은 참여할 수 없는 미션이에요.',
  MISSION_REQUIRES_VERIFICATION: '구독 인증을 마쳐야 완료되는 미션이에요.',
  MISSION_REQUIRES_POST_LIKE: '게시글에 좋아요를 누르면 완료되는 미션이에요.',
  EARN_PROCESSING_FAILED: '응모권을 적립하지 못했어요. 잠시 후 다시 시도해주세요.',
  EARN_STATUS_UNKNOWN: '응모권 적립 결과를 확인하지 못했어요. 다시 눌러 주세요.',
  BALANCE_MAINTENANCE: '응모권 잔액을 정리하는 중이에요. 잠시 후 다시 시도해주세요.',
  WELCOME_QUEST_ALREADY_CLAIMED: '이미 받은 보상이에요.',
  APPROVAL_REQUEST_TOO_LATE: '이벤트 시작 48시간 전까지만 승인을 요청할 수 있어요.',
}

/** 공통 표에 있는 코드면 그 문구, 아니면 화면별 대체 문구. 서버 message와 코드 원문은 쓰지 않는다. */
export function describeError(error, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof ApiError && Object.hasOwn(COMMON_ERROR_MESSAGES, error.code)) {
    return COMMON_ERROR_MESSAGES[error.code]
  }
  return fallback
}
