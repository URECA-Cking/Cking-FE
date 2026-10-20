import { apiClient } from './client.js'
import { JPEG_PNG_IMAGE_TYPES } from '../utils/imageMime.js'

const postPath = (creatorId) => `/api/creators/${creatorId}/posts`

export function getCreatorPosts(creatorId, { page = 0, size = 20 } = {}) {
  return apiClient.get(postPath(creatorId), { page, size })
}

export function getCreatorPost(creatorId, postId) {
  return apiClient.get(`${postPath(creatorId)}/${postId}`)
}

// 크리에이터 본인 게시글 API(Cking-BE docs/domains/post/api.md). Creator 계정의 Access JWT가 필요하다.
export const POST_LIMITS = {
  maxContent: 2000,
  maxImages: 5,
  maxImageBytes: 5 * 1024 * 1024,
  minImageSize: 200,
  imageTypes: JPEG_PNG_IMAGE_TYPES,
}

/** 이미지 1장 업로드 → { imageKey }. 24시간 안에 게시글에 연결하지 않으면 서버가 삭제한다. */
export function uploadPostImage(file) {
  const form = new FormData()
  form.append('image', file)
  return apiClient.post('/api/creator/posts/images', form)
}

/** 작성·수정 공통 본문. imageKeys 순서가 표시 순서다. */
export function createPost({ content, visibility, imageKeys }) {
  return apiClient.post('/api/creator/posts', { content, visibility, imageKeys })
}

/** 부분 수정이 아니라 전체 교체: 유지할 이미지 key도 다시 보내야 하고, 빠진 이미지는 삭제된다. */
export function updatePost(postId, { content, visibility, imageKeys }) {
  return apiClient.patch(`/api/creator/posts/${postId}`, { content, visibility, imageKeys })
}

export function deletePost(postId) {
  return apiClient.delete(`/api/creator/posts/${postId}`)
}

/** 게시글 작성·수정·삭제·이미지 업로드 오류 코드별 사용자 문구. */
export const POST_ERROR_MESSAGES = {
  POST_IMAGE_UNAVAILABLE: '사용할 수 없는 이미지가 있어요. 해당 이미지를 지우고 다시 올려주세요.',
  INVALID_POST_IMAGE: '이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 200×200px 이상인지 확인해주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  FORBIDDEN: '크리에이터 계정만 게시글을 쓸 수 있어요.',
  RESOURCE_NOT_FOUND: '게시글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 본문(2000자 이하)이나 이미지가 하나는 있어야 해요.',
}

// 게시글 댓글 API(Cking-BE docs/domains/post/comment-api.md). 목록은 작성 순(오래된 순)이다.
export const COMMENT_MAX_LENGTH = 500

const commentPath = (creatorId, postId) => `/api/creators/${creatorId}/posts/${postId}/comments`

export function getPostComments(creatorId, postId, { page = 0, size = 20 } = {}) {
  return apiClient.get(commentPath(creatorId, postId), { page, size })
}

export function createComment(creatorId, postId, content) {
  return apiClient.post(commentPath(creatorId, postId), { content })
}

export function updateComment(creatorId, postId, commentId, content) {
  return apiClient.patch(`${commentPath(creatorId, postId)}/${commentId}`, { content })
}

export function deleteComment(creatorId, postId, commentId) {
  return apiClient.delete(`${commentPath(creatorId, postId)}/${commentId}`)
}

/**
 * 필터링되어 목록에서 원문이 가려진 댓글(filtered)의 원문. 게시글을 볼 수 있으면 누구나 요청할 수 있다(로그인 불필요).
 * 작성자 본인의 댓글과 필터링되지 않은 댓글은 404, 개인정보로 막힌 댓글은 COMMENT_NOT_REVEALABLE(403)이다.
 */
export function getCommentOriginal(creatorId, postId, commentId) {
  return apiClient.get(`${commentPath(creatorId, postId)}/${commentId}/original`)
}

/** 댓글 오류 코드별 사용자 문구. FORBIDDEN은 공통 문구(크리에이터 계정 안내)가 맞지 않아 따로 둔다. */
export const COMMENT_ERROR_MESSAGES = {
  COMMENT_FOLLOWERS_ONLY: '팬만 댓글을 쓸 수 있어요. 크리에이터에 도킹해 주세요.',
  POST_FOLLOWERS_ONLY: '팬에게만 공개된 게시글이에요.',
  COMMENT_NOT_REVEALABLE: '원문을 볼 수 없는 댓글이에요.',
  FORBIDDEN: '이 댓글을 수정하거나 삭제할 권한이 없어요.',
  RESOURCE_NOT_FOUND: '댓글이나 게시글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  VALIDATION_FAILED: '댓글은 1자 이상 500자 이하로 입력해주세요.',
}

/** 댓글 신고 사유(Cking-BE comment-api.md). OTHER일 때만 detail(1~200자)이 필수이고, 다른 사유에는 보내지 않는다. */
export const COMMENT_REPORT_REASONS = [
  { value: 'ABUSE', label: '욕설·혐오' },
  { value: 'SPAM', label: '스팸·홍보' },
  { value: 'PRIVACY', label: '개인정보 노출' },
  { value: 'OTHER', label: '기타' },
]
export const COMMENT_REPORT_DETAIL_MAX = 200

/** 신고 → { reportId, commentId, reason, createdAt }. 같은 댓글을 다시 신고해도 처음 접수된 신고가 201로 돌아온다. */
export function reportComment(creatorId, postId, commentId, { reason, detail }) {
  const body = reason === 'OTHER' ? { reason, detail } : { reason }
  return apiClient.post(`${commentPath(creatorId, postId)}/${commentId}/reports`, body)
}

/** 댓글 신고 오류 코드별 문구. VALIDATION_FAILED가 작성용 문구와 달라 따로 둔다. */
export const COMMENT_REPORT_ERROR_MESSAGES = {
  COMMENT_REPORT_LIMIT_EXCEEDED: '짧은 시간에 너무 많이 신고했어요. 잠시 뒤에 다시 시도해주세요.',
  COMMENT_REPORT_OWN_COMMENT: '내가 쓴 댓글은 신고할 수 없어요.',
  POST_FOLLOWERS_ONLY: '팬에게만 공개된 게시글이에요.',
  RESOURCE_NOT_FOUND: '댓글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  VALIDATION_FAILED: '신고 사유를 확인해주세요. 기타는 1~200자의 내용이 필요해요.',
  UNAUTHORIZED: '로그인이 필요해요.',
}

// 게시글 좋아요 API(Cking-BE docs/domains/post/api.md). 로그인 필요, 응답은 { postId, liked, likeCount, missionAwarded }.
// missionAwarded가 true면 이번 좋아요로 좋아요 미션 응모권 적립이 접수된 것이다(미션 완료는 이 경로로만 인정된다).
const likePath = (creatorId, postId) => `${postPath(creatorId)}/${postId}/likes`

export function likePost(creatorId, postId) {
  return apiClient.post(likePath(creatorId, postId))
}

export function unlikePost(creatorId, postId) {
  return apiClient.delete(likePath(creatorId, postId))
}

/** 좋아요·취소 오류 코드별 사용자 문구. */
export const POST_LIKE_ERROR_MESSAGES = {
  POST_FOLLOWERS_ONLY: '팬에게만 공개된 게시글이에요.',
  RESOURCE_NOT_FOUND: '게시글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  UNAUTHORIZED: '로그인이 필요해요.',
}
