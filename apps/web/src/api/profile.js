import { ApiError, apiClient, describeError } from './client.js'
import { getMe } from './auth.js'
import { profileMock } from '../dev/profileMock.js'
import { normalizeMe } from '../utils/nickname.js'

// 내 프로필 API(Cking-BE #518 닉네임 정책, #519 프로필 사진 업로드 및 내 프로필 수정 API).
// 필드 이름·오류 코드는 BE 문서가 확정되면 맞춘다. 확정 전에는 `?mock=1`로 화면을 확인한다(dev/profileMock.js).

export const PROFILE_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minSize: 200,
  types: ['image/jpeg', 'image/png'],
}

const mockActive = () => profileMock !== null && new URLSearchParams(window.location.search).get('mock') === '1'

/** GET /api/me. 프로필 필드(nickname, profileImageUrl, profileConfigured, nicknameChangeableAt, restorableNickname)를 포함한다. */
export async function getMyProfile() {
  const me = normalizeMe(await getMe())
  return mockActive() ? profileMock.me(me) : me
}

/** POST /api/me/profile-images — 이미지 1장 업로드 → { imageKey }. 24시간 안에 프로필에 연결하지 않으면 서버가 지운다. */
export function uploadProfileImage(file) {
  if (mockActive()) return profileMock.upload(file)
  const form = new FormData()
  form.append('image', file)
  return apiClient.post('/api/me/profile-images', form)
}

/**
 * PUT /api/me/profile — 닉네임과 사진 key를 모두 보내는 전체 교체.
 * profileImageKey가 null이면 기본 이미지로 돌아가고, 사진을 바꾸지 않을 때는 현재 key를 다시 보낸다.
 * 저장 뒤에는 서버 값을 그대로 쓰도록 /api/me를 다시 읽어 돌려준다(PUT 응답 형태에 기대지 않는다).
 */
export async function updateMyProfile({ nickname, profileImageKey }) {
  if (mockActive()) {
    const me = normalizeMe(await getMe())
    return profileMock.update(profileMock.me(me), { nickname, profileImageKey })
  }
  await apiClient.put('/api/me/profile', { nickname, profileImageKey })
  return getMyProfile()
}

/** 프로필 미설정 회원이 공개 활동을 하면 BE가 이 코드(409)로 막는다. */
export const PROFILE_SETUP_REQUIRED = 'PROFILE_SETUP_REQUIRED'

/** ApiError(throw된 오류)와 envelope({ code })를 모두 받는다. */
export function isProfileSetupRequired(error) {
  return error?.code === PROFILE_SETUP_REQUIRED
}

/**
 * 프로필 저장·사진 업로드 오류 코드별 문구. NICKNAME_ALREADY_TAKEN·NICKNAME_CHANGE_TOO_SOON·PROFILE_SETUP_REQUIRED는 BE(#518)가 확정한 코드다.
 * 사진 오류 코드(#519)는 아직 확정 전이라 모르는 코드는 서버 메시지나 상태 코드로 대신한다.
 */
export const PROFILE_ERROR_MESSAGES = {
  NICKNAME_ALREADY_TAKEN: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.',
  NICKNAME_CHANGE_TOO_SOON: '닉네임은 마지막으로 바꾼 뒤 14일이 지나야 다시 바꿀 수 있어요.',
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 닉네임은 1~20자, 한글·영문·숫자·_·-만 쓸 수 있어요.',
  INVALID_PROFILE_IMAGE: '이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 200×200px 이상인지 확인해주세요.',
  PROFILE_IMAGE_UNAVAILABLE: '사용할 수 없는 사진이에요. 사진을 다시 올려주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  [PROFILE_SETUP_REQUIRED]: '먼저 닉네임을 설정해주세요.',
}

export function describeProfileError(error, fallback = '프로필을 저장하지 못했어요.') {
  if (error instanceof ApiError) {
    if (PROFILE_ERROR_MESSAGES[error.code]) return PROFILE_ERROR_MESSAGES[error.code]
    // 코드명이 확정되기 전의 409는 닉네임 중복·변경 제한 계열이므로 안내를 한 가지로 묶는다.
    if (error.status === 409) return error.message || '지금은 이 닉네임으로 바꿀 수 없어요. 다른 닉네임을 입력하거나 나중에 다시 시도해주세요.'
  }
  return describeError(error, fallback)
}
