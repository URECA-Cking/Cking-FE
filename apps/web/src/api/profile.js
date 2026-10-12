import { ApiError, apiClient, describeError } from './client.js'
import { getMe } from './auth.js'

// 내 프로필 API(Cking-BE #518 닉네임 정책, #519 프로필 사진 업로드 및 내 프로필 수정 API, docs/domains/member/api.md).

export const PROFILE_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minSize: 200,
  types: ['image/jpeg', 'image/png'],
}

/** GET /api/me. 프로필 필드(nickname, profileImageUrl, profileConfigured, nicknameChangeableAt, restorableNickname)를 포함한다. */
export function getMyProfile() {
  return getMe()
}

/** POST /api/me/profile-images — 이미지 1장 업로드 → { imageKey }. 24시간 안에 프로필에 연결하지 않으면 서버가 지운다. */
export function uploadProfileImage(file) {
  const form = new FormData()
  form.append('image', file)
  return apiClient.post('/api/me/profile-images', form)
}

/**
 * PUT /api/me/profile — 닉네임은 항상 보내고, 사진은 `profileImageKey`로 정한다.
 * undefined면 필드를 보내지 않아 현재 사진을 유지하고, 새로 올린 key면 교체하고, null이면 기본 이미지로 돌아간다.
 * 닉네임과 사진은 서버가 한 번에 저장한다. 응답은 GET /api/me와 같다.
 */
export function updateMyProfile({ nickname, profileImageKey }) {
  const body = profileImageKey === undefined ? { nickname } : { nickname, profileImageKey }
  return apiClient.put('/api/me/profile', body)
}

/** 프로필 미설정 회원이 공개 활동을 하면 BE가 이 코드(409)로 막는다. */
export const PROFILE_SETUP_REQUIRED = 'PROFILE_SETUP_REQUIRED'

/** ApiError(throw된 오류)와 envelope({ code })를 모두 받는다. */
export function isProfileSetupRequired(error) {
  return error?.code === PROFILE_SETUP_REQUIRED
}

/** 프로필 저장·사진 업로드 오류 코드별 문구. 모르는 코드는 서버 메시지나 상태 코드로 대신한다. */
export const PROFILE_ERROR_MESSAGES = {
  NICKNAME_ALREADY_TAKEN: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.',
  NICKNAME_CHANGE_TOO_SOON: '닉네임은 마지막으로 바꾼 뒤 14일이 지나야 다시 바꿀 수 있어요.',
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 닉네임은 1~20자, 한글·영문·숫자·_·-만 쓸 수 있어요.',
  INVALID_PROFILE_IMAGE: '이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 200×200px 이상인지 확인해주세요.',
  PROFILE_IMAGE_UNAVAILABLE: '사용할 수 없는 사진이에요. 사진을 다시 올려주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  IMAGE_PROCESSING_BUSY: '지금 사진을 처리하는 요청이 많아요. 잠시 뒤에 다시 시도해주세요.',
  [PROFILE_SETUP_REQUIRED]: '먼저 닉네임을 설정해주세요.',
}

export function describeProfileError(error, fallback = '프로필을 저장하지 못했어요.') {
  if (error instanceof ApiError) {
    if (PROFILE_ERROR_MESSAGES[error.code]) return PROFILE_ERROR_MESSAGES[error.code]
    // 위에 없는 409는 서버 메시지를 그대로 보여준다.
    if (error.status === 409) return error.message || '지금은 이 닉네임으로 바꿀 수 없어요. 다른 닉네임을 입력하거나 나중에 다시 시도해주세요.'
  }
  return describeError(error, fallback)
}
