import { ApiError, apiClient, newRequestId, requestEnvelope } from './client';

export async function getCreatorMissions(creatorId, userId) {
  return apiClient.get(`/api/creators/${creatorId}/missions`, { userId });
}

export async function completeCreatorMission(creatorId, missionId, userId) {
  const response = await requestEnvelope(`/api/creators/${creatorId}/missions/${missionId}/complete`, {
    method: 'POST',
    body: { userId, requestId: newRequestId() },
  });
  if (!response.ok || !['EARN_ACCEPTED', 'ALREADY_PROCESSED'].includes(response.code)) {
    throw new ApiError(response.code, response.message, response.status);
  }
  return response.data;
}
