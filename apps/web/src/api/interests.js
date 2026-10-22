import { apiClient } from './client.js'

/**
 * GET /api/interests - 선택할 수 있는 관심 분야 목록(인증 불필요, displayOrder 순)
 * 응답: { taxonomyVersion, maxSelection, items: [{ interestCode, name, displayOrder }] }
 * 활성 분류체계가 없으면 taxonomyVersion이 null, items가 빈 배열이다(저장할 수 없다).
 */
export function getInterests() {
  return apiClient.get('/api/interests')
}

/**
 * GET /api/me/interests - 내가 고른 관심 분야
 * 응답: { taxonomyVersion, interestCodes }. 여기의 taxonomyVersion은 과거에 저장한 선택의 버전이라
 * 저장 요청에는 쓰지 않는다(분류체계가 바뀌면 400이 된다).
 */
export function getMyInterests() {
  return apiClient.get('/api/me/interests')
}

/**
 * PUT /api/me/interests - 관심 분야 전체 교체(멱등). 빈 배열이면 전체 해제.
 * taxonomyVersion은 getInterests() 응답 값을 보낸다. 선택 수 상한은 응답의 maxSelection으로 화면에서 먼저 막는다.
 * @param {{ taxonomyVersion: string, interestCodes: string[] }} selection
 */
export function saveMyInterests({ taxonomyVersion, interestCodes }) {
  return apiClient.put('/api/me/interests', { taxonomyVersion, interestCodes })
}
