import { ApiError, apiClient, newRequestId, requestEnvelope } from './client';

export async function getCreatorMissions(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/missions`);
}

// 신규 적립(EARN_ACCEPTED)과 같은 requestId 재전송(ALREADY_PROCESSED)만 성공이다.
async function postComplete(path, requestId) {
  const response = await requestEnvelope(path, { method: 'POST', body: { requestId } });
  if (!response.ok || !['EARN_ACCEPTED', 'ALREADY_PROCESSED'].includes(response.code)) {
    throw new ApiError(response.code, response.message, response.status);
  }
  return response.data;
}

export async function completeCreatorMission(creatorId, missionId) {
  return postComplete(`/api/creators/${creatorId}/missions/${missionId}/complete`, newRequestId());
}

/** GET /api/missions - 크리에이터와 무관한 공용 미션(현재 출석 한 유형) 조회 */
export async function getCommonMissions() {
  return apiClient.get('/api/missions');
}

/**
 * POST /api/missions/{missionId}/complete - 공용 미션 완료.
 * 타임아웃(EARN_STATUS_UNKNOWN/504) 뒤 재시도할 때 중복 지급을 막으려면 호출자가 같은 requestId를 넘긴다.
 */
export async function completeCommonMission(missionId, requestId = newRequestId()) {
  return postComplete(`/api/missions/${missionId}/complete`, requestId);
}
