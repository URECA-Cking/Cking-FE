import { apiClient } from './client'
import { postEarnRequest } from './missions.js'
import { buildClaimBody } from '../utils/welcomeQuest.js'

/**
 * GET /api/me/welcome-quest - 신규 회원 여부(eligible)와 단계·보너스별 지급 상태 조회.
 * 조회만 하며 지급하지 않는다. 비대상 회원은 eligible=false에 items는 빈 배열, bonus는 null이다.
 */
export async function getWelcomeQuest() {
  return apiClient.get('/api/me/welcome-quest')
}

/**
 * POST /api/me/welcome-quest/{step}/claim - 단계 또는 보너스의 공용 응모권 지급 요청.
 * 승인 여부가 불확실한 실패(EARN_STATUS_UNKNOWN 등) 뒤에는 호출자가 같은 requestId와 같은 answer로 재시도해야 한다.
 * 성공(EARN_ACCEPTED·ALREADY_PROCESSED)이면 { step, rewardAmount, status }를 돌려준다.
 */
export async function claimWelcomeQuestStep(step, { requestId, answer } = {}) {
  return postEarnRequest(`/api/me/welcome-quest/${step}/claim`, buildClaimBody(step, { requestId, answer }))
}
