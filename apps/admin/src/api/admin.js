import { del, get, patch, post } from './client.js'

// 관리자 전용 API. 백엔드는 Access JWT의 role이 ADMIN이 아니면 FORBIDDEN을 돌려준다.

/** 승인 대기 중인 이벤트 목록을 페이지 단위로 조회한다. */
export async function getPendingEvents({ page = 0, size = 20 } = {}) {
  return get('/api/admin/events/pending', { page, size });
}

/** 승인 대기 이벤트를 SCHEDULED 상태로 승인한다. */
export async function approveEvent(eventId) {
  return post(`/api/admin/events/${eventId}/approve`);
}

/** 승인 대기 이벤트를 사유와 함께 거절한다. */
export async function rejectEvent(eventId, rejectReason) {
  return post(`/api/admin/events/${eventId}/reject`, { rejectReason });
}

/** 이벤트의 비동기 마감 진행 상태를 조회한다. */
export async function getClosingStatus(eventId) {
  return get(`/api/admin/events/${eventId}/closing-status`);
}

/** 추첨에 사용할 이벤트의 공식 스냅샷을 조회한다. */
export async function getEventSnapshot(eventId) {
  return get(`/api/admin/events/${eventId}/snapshot`);
}

/** 마감된 이벤트의 초기 추첨을 실행한다. */
export async function runInitialDrawing(eventId) {
  return post(`/api/admin/events/${eventId}/drawings`);
}

/** 추첨 메타데이터와 현재 실행 상태를 조회한다. */
export async function getDrawing(drawingId) {
  return get(`/api/admin/drawings/${drawingId}`);
}

/** Event에 연결된 INITIAL Drawing의 실행 상태를 조회한다. */
export async function getInitialDrawing(eventId) {
  return get(`/api/admin/events/${eventId}/drawings/initial`)
}

/** 완료된 추첨의 관리자용 당첨자 결과를 조회한다. */
export async function getDrawingResult(drawingId) {
  return get(`/api/admin/drawings/${drawingId}/result`);
}

/** 완료된 추첨 결과를 공개한다. */
export async function publishDrawing(drawingId) {
  return post(`/api/admin/drawings/${drawingId}/publish`);
}

/** 완료된 추첨 결과의 무결성을 검증한다. */
export async function verifyDrawing(drawingId) {
  return post(`/api/admin/drawings/${drawingId}/verify`);
}

/** 추첨 검증 이력을 페이지 단위로 조회한다. */
export async function getDrawingVerificationHistory(drawingId, { page = 0, size = 20 } = {}) {
  return get(`/api/admin/drawings/${drawingId}/verification-history`, { page, size });
}

/** 선택된 당첨자의 수령을 완료 처리한다. */
export async function receiveWinner(winnerId) {
  return post(`/api/admin/winners/${winnerId}/receive`)
}

/** 선택된 당첨자의 자격을 사유와 함께 박탈한다. */
export async function disqualifyWinner(winnerId, reason) {
  return post(`/api/admin/winners/${winnerId}/disqualify`, { reason })
}

/** 당첨자의 상태 변경 이력을 조회한다. */
export async function getWinnerHistory(winnerId) {
  return get(`/api/winners/${winnerId}/history`)
}

/** 공개 이벤트의 결원을 기준으로 재추첨 요청을 생성한다. */
export async function createRedrawRequest(eventId, reason, idempotencyKey) {
  return post(`/api/admin/events/${eventId}/redraw-requests`, { reason, idempotencyKey })
}

/** 재추첨 요청의 고정 결원과 심사·실행 상세를 조회한다. */
export async function getRedrawRequest(redrawRequestId) {
  return get(`/api/admin/redraw-requests/${redrawRequestId}`)
}

/** 상태 조건에 맞는 재추첨 요청 목록을 페이지 단위로 조회한다. */
export async function getRedrawRequests({ status, executionStatus, page = 0, size = 20 } = {}) {
  return get('/api/admin/redraw-requests', { status, executionStatus, page, size })
}

/** 심사 대기 재추첨 요청을 승인해 실행 가능 상태로 바꾼다. */
export async function approveRedrawRequest(redrawRequestId) {
  return post(`/api/admin/redraw-requests/${redrawRequestId}/approve`)
}

/** 심사 대기 재추첨 요청을 반려 사유와 함께 거절한다. */
export async function rejectRedrawRequest(redrawRequestId, rejectReason) {
  return post(`/api/admin/redraw-requests/${redrawRequestId}/reject`, { rejectReason })
}

/** 승인되고 아직 실행되지 않은 재추첨 요청을 실행한다. */
export async function executeRedrawRequest(redrawRequestId) {
  return post(`/api/admin/redraw-requests/${redrawRequestId}/execute`)
}

/** 실패한 추첨을 기존 Drawing과 Seed를 재사용해 다시 실행한다. */
export async function retryDrawing(drawingId) {
  return post(`/api/admin/drawings/${drawingId}/retry`)
}

/** 열려 있는 이벤트의 비동기 마감을 시작하거나 현재 마감 상태를 반환한다. */
export async function closeEvent(eventId) {
  return post(`/api/events/${eventId}/close`)
}

/** PUBLISHED Event를 사용자·Creator 화면에서 제외하는 관리자 보관함으로 옮긴다. */
export function archiveEvent(eventId) {
  return patch(`/api/admin/events/${eventId}/archive`)
}

/** 보관 Event를 기존 PUBLISHED 상태로 다시 노출한다. */
export function unarchiveEvent(eventId) {
  return patch(`/api/admin/events/${eventId}/unarchive`)
}

/** 처리 상태별 Dead Stream 메시지를 페이지 단위로 조회한다. */
export async function getDeadStreams({ status = 'UNRESOLVED', page = 0, size = 20 } = {}) {
  return get('/api/admin/dead-streams', { status, page, size })
}

/** 처리 실패한 Dead Stream 메시지를 보존된 원본으로 다시 처리한다. */
export async function replayDeadStream(deadStreamId) {
  return post(`/api/admin/dead-streams/${deadStreamId}/replay`)
}

/** 크리에이터 전환 신청 목록을 페이지 단위로 조회한다. */
export async function getCreatorApplications({ status, page = 0, size = 20 } = {}) {
  return get('/api/admin/creator-applications', { status, page, size });
}

/** 페이지 기반 관리자 목록을 모두 읽어 Dashboard 집계에 사용할 항목을 반환한다. */
async function getAllPages(loadPage, size = 100) {
  const items = []
  let page = 0
  let hasNext = true

  while (hasNext) {
    const result = await loadPage({ page, size })
    items.push(...(result?.items ?? []))
    hasNext = result?.hasNext === true
    page += 1
  }

  return items
}

/** 목록·상세 조회와 Dashboard 집계를 위해 모든 Creator 신청을 조회한다. */
export function getAllCreatorApplications() {
  return getAllPages((params) => getCreatorApplications(params))
}

/** 목록·상세 조회와 Dashboard 집계를 위해 모든 승인 대기 이벤트를 조회한다. */
export function getAllPendingEvents() {
  return getAllPages((params) => getPendingEvents(params))
}

/** Dashboard의 검토 대기 재추첨 집계를 위해 REQUESTED 요청을 모두 조회한다. */
export function getAllRequestedRedraws() {
  return getAllPages((params) => getRedrawRequests({ ...params, status: 'REQUESTED' }))
}

/** Dashboard의 미처리 메시지 집계를 위해 UNRESOLVED Dead Stream을 모두 조회한다. */
export function getAllUnresolvedDeadStreams() {
  return getAllPages((params) => getDeadStreams({ ...params, status: 'UNRESOLVED' }))
}

/** 크리에이터 전환 신청을 승인한다. */
export async function approveCreatorApplication(applicationId) {
  return post(`/api/admin/creator-applications/${applicationId}/approve`);
}

/** 크리에이터 전환 신청을 사유와 함께 거절한다. */
export async function rejectCreatorApplication(applicationId, rejectReason) {
  return post(`/api/admin/creator-applications/${applicationId}/reject`, { rejectReason });
}

/** 신고된 댓글을 댓글별로 모아 최근 신고 순으로 조회한다. status(PENDING·RESOLVED·REJECTED)를 생략하면 전체다. */
export async function getCommentReports({ status, page = 0, size = 20 } = {}) {
  return get('/api/admin/comment-reports', { status, page, size })
}

/** 신고된 댓글을 숨기고 그 댓글의 접수 신고를 모두 처리 완료로 바꾼다. 되돌릴 수 없고, 이미 숨겼으면 처리 수 0으로 성공한다. */
export async function hideReportedComment(commentId) {
  return post(`/api/admin/comment-reports/${commentId}/hide`)
}

/** 그 댓글의 접수 신고를 모두 반려한다. 댓글은 그대로 보인다. 이미 반려했으면 처리 수 0으로 성공하고, 숨긴 댓글은 409다. */
export async function rejectCommentReports(commentId) {
  return post(`/api/admin/comment-reports/${commentId}/reject`)
}

/** 지정 회원의 Creator 전용 또는 공용 응모권 Redis·MySQL 잔액을 비교 조회한다. */
export function getAdminTicketBalance({ memberId, couponType, creatorId }) {
  return get('/api/admin/tickets/balance', { memberId, couponType, ...(couponType === 'CREATOR' ? { creatorId } : {}) })
}

/** useAsync가 보존한 원본 오류에서 Redis 잔액 조회 장애를 구분한다. */
export function isRedisBalanceQueryFailed(error) {
  return error?.code === 'REDIS_BALANCE_QUERY_FAILED'
}

/** 지정 회원의 응모권 원장을 커서 기준으로 조회한다. */
export function getAdminTicketHistory({ memberId, couponType, creatorId, cursor, size = 20 }) {
  return get('/api/admin/tickets/history', { memberId, couponType, ...(couponType === 'CREATOR' ? { creatorId } : {}), cursor, size })
}

/** Creator 전용 응모권의 Redis 잔액을 DB 기준으로 수동 재동기화한다. */
export function resyncCreatorTickets(memberId, creatorId, reason) {
  return post('/api/admin/tickets/resync', { memberId, creatorId, reason })
}

/** 공용 응모권의 Redis 잔액을 DB 기준으로 수동 재동기화한다. */
export function resyncCommonTickets(memberId, reason) {
  return post('/api/admin/tickets/common/resync', { memberId, reason })
}

/** 상태·보관 여부·페이지 조건을 서버에 전달해 관리자 Event 목록을 조회한다. */
export function getAdminEvents({ status, archiveStatus = 'ACTIVE', page = 0, size = 20 } = {}) {
  return get('/api/admin/events', { status, archiveStatus, page, size })
}

const DASHBOARD_OPERATING_EVENT_STATUSES = ['CLOSING', 'OPEN', 'CLOSED', 'DRAW_COMPLETED']

/** Dashboard의 마감 처리 건수를 정확히 표시하기 위해 CLOSING 전체 건수만 조회한다. */
export function getClosingEventSummary() {
  return getAdminEvents({ status: 'CLOSING', page: 0, size: 1 })
}

/**
 * Dashboard 표에 필요한 운영 상태만 각 첫 페이지에서 제한적으로 읽는다.
 * 목록 화면처럼 다음 페이지를 계속 순회하지 않으며, 최대 8건만 표시한다.
 */
export async function getDashboardOperatingEvents() {
  const results = await Promise.all(
    DASHBOARD_OPERATING_EVENT_STATUSES.map((status) => getAdminEvents({ status, page: 0, size: 8 })),
  )
  return { items: results.flatMap((result) => result?.items ?? []).slice(0, 8) }
}

/** 운영·보관 Event 목록을 서버 상태 필터와 페이지네이션으로 조회한다. */
export function getOperatingEvents(options) {
  const { status, archiveStatus = 'ACTIVE', page = 0, size = 20 } = options ?? {}
  return getAdminEvents({
    status: status ?? (archiveStatus === 'ARCHIVED' ? 'PUBLISHED' : undefined),
    archiveStatus,
    page,
    size,
  })
}

/** 관리자 운영 상세의 Event·Snapshot·INITIAL Drawing 요약을 한 번에 조회한다. */
export function getOperatingEvent(eventId) {
  return get(`/api/admin/events/${eventId}/operation`)
}

/** 조건에 맞는 Abuse Detection을 서버 페이지 단위로 조회한다. */
export async function getAbuseDetections({
  memberId,
  abuseType,
  status,
  detectedAtFrom,
  detectedAtTo,
  page = 0,
  size = 20,
} = {}) {
  return get('/api/admin/abuse-detections', {
    ...(memberId ? { memberId } : {}),
    ...(abuseType ? { abuseType } : {}),
    ...(status ? { status } : {}),
    ...(detectedAtFrom ? { detectedAtFrom } : {}),
    ...(detectedAtTo ? { detectedAtTo } : {}),
    page,
    size,
  })
}

/** 하나의 Abuse Detection과 전체 Evidence를 조회한다. */
export async function getAbuseDetection(detectionId) {
  return get(`/api/admin/abuse-detections/${detectionId}`)
}

/** 관리자의 최종 검토 판정을 기록한다. */
export async function reviewAbuseDetection(detectionId, status) {
  return patch(`/api/admin/abuse-detections/${detectionId}/review`, { status })
}

/** Verification의 정규화 이미지 exact-match 재사용 탐지 결과를 조회한다. */
export function getSubscriptionVerificationImageReuse(verificationId) {
  return get(`/api/admin/subscription-verifications/${verificationId}/image-reuse`)
}

/** 신고 여부와 상관없이 댓글을 삭제한다. 물리 삭제라 되돌릴 수 없고, 그 댓글의 신고도 함께 지워지며, 작성자 경고·알림·이력은 남지 않는다(204). */
export async function deleteComment(commentId) {
  return del(`/api/admin/comments/${commentId}`)
}

/** 지정한 크리에이터의 스페이스에서 회원의 댓글 작성·수정을 지금부터 days일(1~365) 막는다. 이미 유효한 차단이 있으면 새로 만들지 않고 기존 차단을 같은 201로 돌려준다. */
export async function createSpaceCommentBlock({ creatorId, memberId, days }) {
  return post('/api/admin/comment-blocks', { creatorId, memberId, days })
}

/** 모든 스페이스의 차단을 시작 최신순으로 조회한다. creatorId·memberId로 좁히고, activeOnly면 지금 유효한 차단만 본다. */
export async function getSpaceCommentBlocks({ creatorId, memberId, activeOnly = false, page = 0, size = 20 } = {}) {
  return get('/api/admin/comment-blocks', { creatorId, memberId, active: activeOnly, page, size })
}

/** 스페이스 차단을 지금 해제한다. 이미 끝났거나 해제된 차단도 성공(멱등)하고, 플랫폼 제재는 404다. */
export async function releaseSpaceCommentBlock(sanctionId) {
  return post(`/api/admin/comment-blocks/${sanctionId}/release`)
}

/** 회원에게 모든 스페이스에서 댓글 작성·수정을 지금부터 days일(1~365) 막는다. 사유(1~200자)는 필수이고 경고 횟수에는 세지 않는다. 이미 제한 중이어도 새 제한을 따로 기록하며 201과 제재를 돌려준다. */
export async function createPlatformSanction({ memberId, days, reason }) {
  return post('/api/admin/sanctions', { memberId, days, reason })
}

/** 플랫폼 제재(자동 경고·관리자 수동 제한)를 시작 최신순으로 조회한다. 스페이스 차단은 포함하지 않는다. memberId로 좁히고, activeOnly면 지금 유효한 제한만 본다. */
export async function getPlatformSanctions({ memberId, activeOnly = false, page = 0, size = 20 } = {}) {
  return get('/api/admin/sanctions', { memberId, active: activeOnly, page, size })
}

/** 플랫폼 제한을 지금 해제한다. 이미 끝났거나 해제된 제한도 성공(멱등)하고, 스페이스 차단은 404다. 자동 경고는 해제해도 경고 횟수에 남는다. */
export async function releasePlatformSanction(sanctionId) {
  return post(`/api/admin/sanctions/${sanctionId}/release`)
}
