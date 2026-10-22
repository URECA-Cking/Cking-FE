import { ApiError, apiClient, describeError } from './client.js'
import {
  isSupportedSubscriptionVerificationImage,
  SUBSCRIPTION_VERIFICATION_IMAGE_TYPES,
} from '../utils/subscriptionVerificationImage.js'

// Cking-BE docs/domains/subscription-verification/api.md.
// 브라우저 검증은 불필요한 업로드를 줄이기 위한 보조 수단이며, 이미지의 실제 형식·해상도 판단은 서버가 한다.
export const SUBSCRIPTION_VERIFICATION_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  types: SUBSCRIPTION_VERIFICATION_IMAGE_TYPES,
}

const missionPath = (creatorId, missionId) => `/api/creators/${creatorId}/missions/${missionId}/subscription-verifications`

export function getCreatorYoutubeChannel(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/youtube-channel`)
}

export function getMyYoutubeChannel() {
  return apiClient.get('/api/creator/youtube-channel')
}

export function updateMyYoutubeChannel({ channelName, channelHandle }) {
  return apiClient.put('/api/creator/youtube-channel', { channelName, channelHandle })
}

export function submitSubscriptionVerification({ creatorId, missionId, requestId, image }) {
  const form = new FormData()
  form.append('requestId', requestId)
  form.append('image', image)
  return apiClient.post(missionPath(creatorId, missionId), form)
}

export function getLatestSubscriptionVerification(creatorId, missionId) {
  return apiClient.get(`${missionPath(creatorId, missionId)}/me/latest`)
}

export function validateSubscriptionVerificationImage(file) {
  if (!isSupportedSubscriptionVerificationImage(file)) {
    return 'JPEG 또는 PNG 이미지만 올릴 수 있어요.'
  }
  if (file.size > SUBSCRIPTION_VERIFICATION_IMAGE_LIMITS.maxBytes) {
    return '이미지는 5MB 이하만 올릴 수 있어요.'
  }
  return null
}

export const SUBSCRIPTION_VERIFICATION_ERROR_MESSAGES = {
  INVALID_VERIFICATION_IMAGE: '인증 이미지가 유효하지 않아요. YouTube 구독 화면이 보이는 JPEG 또는 PNG를 선택해주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  VERIFICATION_IN_PROGRESS: '이미 처리 중인 구독 인증이 있어요. 잠시 후 상태를 확인해주세요.',
  VERIFICATION_ALREADY_APPROVED: '이미 이 구독 인증 미션을 완료했어요.',
  VERIFICATION_SUBMISSION_LIMIT_EXCEEDED: '잠시 후 다시 제출할 수 있어요. 제출 횟수 제한을 확인해주세요.',
  VERIFICATION_UNAVAILABLE: '구독 인증이 현재 준비 중이에요. 잠시 후 다시 시도해주세요.',
  IMAGE_PROCESSING_BUSY: '이미지 처리 요청이 많아요. 잠시 후 다시 시도해주세요.',
  CREATOR_CHANNEL_NOT_CONFIGURED: '크리에이터가 아직 YouTube 채널을 설정하지 않았어요.',
  INVALID_VERIFICATION_MISSION: '현재 제출할 수 없는 미션이에요.',
  MISSION_INACTIVE: '현재 활성 상태가 아닌 미션이에요.',
  IDEMPOTENCY_CONFLICT: '같은 제출 요청에 다른 이미지가 사용됐어요. 새로 시도해주세요.',
  INVALID_STATE: '처리 중인 구독 인증이 있어 현재 YouTube 채널을 변경할 수 없어요.',
  CHANNEL_HANDLE_CONFLICT: '이미 사용 중인 채널 아이디예요.',
  VALIDATION_FAILED: '입력값 또는 파일 형식을 확인해주세요.',
}

export function describeSubscriptionVerificationError(error, fallback = '구독 인증 요청을 처리하지 못했어요.') {
  if (error instanceof ApiError && SUBSCRIPTION_VERIFICATION_ERROR_MESSAGES[error.code]) {
    return SUBSCRIPTION_VERIFICATION_ERROR_MESSAGES[error.code]
  }
  return describeError(error, fallback)
}
