import { ApiError, apiClient, newRequestId, requestEnvelope } from './client';

export async function getCreatorMissions(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/missions`);
}

/**
 * 응모권 지급(EARN) 요청을 보내고 결과를 판정한다. 공용 미션 완료와 웰컴 퀘스트 지급이 함께 쓴다.
 * 신규 적립(EARN_ACCEPTED)과 같은 requestId 재전송(ALREADY_PROCESSED)만 성공이고, 그 밖의 응답은 ApiError로 던진다.
 */
export async function postEarnRequest(path, body) {
  const response = await requestEnvelope(path, { method: 'POST', body });
  if (!response.ok || !['EARN_ACCEPTED', 'ALREADY_PROCESSED'].includes(response.code)) {
    throw new ApiError(response.code, response.message, response.status);
  }
  return response.data;
}

/** requestId만 본문으로 보내는 미션 완료 요청. */
function postComplete(path, requestId) {
  return postEarnRequest(path, { requestId });
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
