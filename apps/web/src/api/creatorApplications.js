import { ApiError, apiClient, describeError } from './client.js'

const APPLICATION_ERROR_MESSAGES = {
  APPLICATION_CONTENT_CONFLICT: '진행 중인 신청서가 있어요. 신청 상태를 다시 확인해주세요.',
  APPLICATION_FORM_REQUIRED: '신청서 내용을 다시 확인하고 제출해주세요.',
  APPLICATION_NOT_EDITABLE: '이 신청서는 더 이상 수정할 수 없어요. 상태를 다시 확인해주세요.',
  VALIDATION_FAILED: '신청서의 입력값과 증빙 URL을 확인해주세요.',
}

export function describeCreatorApplicationError(error, fallback = '신청서를 제출하지 못했어요.') {
  return error instanceof ApiError && APPLICATION_ERROR_MESSAGES[error.code]
    ? APPLICATION_ERROR_MESSAGES[error.code]
    : describeError(error, fallback)
}

// POST /api/creator/applications - 크리에이터 전환 신청
export function applyCreator(form) {
  return apiClient.post('/api/creator/applications', form)
}

// GET /api/creator/applications/me - 내 크리에이터 신청 내역(페이지네이션)
export async function getMyCreatorApplications({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/applications/me', { page, size })
}

export function getMyCreatorApplication(applicationId) { return apiClient.get(`/api/creator/applications/${applicationId}`) }
export function updateCreatorApplication(applicationId, form) { return apiClient.patch(`/api/creator/applications/${applicationId}`, form) }
export function resubmitCreatorApplication(applicationId) { return apiClient.post(`/api/creator/applications/${applicationId}/resubmit`) }
