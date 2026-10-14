import { apiClient } from './client';

// 크리에이터의 스페이스 댓글 차단 API(Creator JWT 필수). 계약 정본: Cking-BE docs/domains/sanction/api.md '크리에이터 스페이스 댓글 차단 API'.
// 차단 응답: { sanctionId, memberId, memberName, startedAt, endsAt, releasedAt, active }

/** POST /api/creator/comment-blocks - 지금부터 days일(1~365) 차단. 이미 유효한 차단이 있으면 새로 만들지 않고 기존 차단을 같은 201로 돌려준다. */
export async function createCommentBlock({ memberId, days }) {
  return apiClient.post('/api/creator/comment-blocks', { memberId, days });
}

/** GET /api/creator/comment-blocks - 내 스페이스에 건 차단(시작 최신순). activeOnly면 지금 유효한 차단만 */
export async function getCommentBlocks({ activeOnly = false, page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/comment-blocks', { active: activeOnly, page, size });
}

/** POST /api/creator/comment-blocks/{sanctionId}/release - 차단 해제. 이미 끝났거나 해제된 차단도 성공(멱등)한다. */
export async function releaseCommentBlock(sanctionId) {
  return apiClient.post(`/api/creator/comment-blocks/${sanctionId}/release`);
}
