import { apiClient } from './client.js'

// 관리자가 Web 댓글창에서 쓰는 댓글 조치 API(ADMIN 권한 필요). 계약 정본: Cking-BE docs/domains/sanction/api.md '관리자 스페이스 댓글 차단 API',
// docs/domains/post/comment-api.md 'DELETE /api/admin/comments/{commentId}'. 게시글 주인(크리에이터)은 이 API 대신 크리에이터 API를 쓴다.

/** DELETE /api/admin/comments/{commentId} - 신고 여부와 무관한 물리 삭제(204). 신고도 함께 지워지고 작성자 경고·알림·삭제 이력은 남지 않는다. */
export async function deleteCommentAsAdmin(commentId) {
  return apiClient.delete(`/api/admin/comments/${commentId}`)
}

/** POST /api/admin/comment-blocks - 지정한 크리에이터의 스페이스에서 회원을 days일(1~365) 차단. 이미 유효한 차단이 있으면 기존 차단을 같은 201로 돌려준다. */
export async function createCommentBlockAsAdmin({ creatorId, memberId, days }) {
  return apiClient.post('/api/admin/comment-blocks', { creatorId, memberId, days })
}
