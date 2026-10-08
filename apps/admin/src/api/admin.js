import { get, patch, post } from './client.js'

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

/** 처리 상태별 Dead Stream 메시지를 페이지 단위로 조회한다. */
export async function getDeadStreams({ status = 'UNRESOLVED', page = 0, size = 20 } = {}) {
  return get('/api/admin/dead-streams', { status, page, size })
}

/** 처리 실패한 Dead Stream 메시지를 보존된 원본으로 다시 처리한다. */
export async function replayDeadStream(deadStreamId) {
  return post(`/api/admin/dead-streams/${deadStreamId}/replay`)
}

/** 크리에이터 전환 신청 목록을 페이지 단위로 조회한다. */
export async function getCreatorApplications({ page = 0, size = 20 } = {}) {
  return get('/api/admin/creator-applications', { page, size });
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

export const OPERATING_EVENT_STATUSES = ['SCHEDULED', 'OPEN', 'CLOSING', 'CLOSED', 'DRAW_COMPLETED', 'PUBLISHED']
const DRAWING_READY_EVENT_STATUSES = ['CLOSED', 'DRAW_COMPLETED', 'PUBLISHED']

/** 지정한 상태의 이벤트 목록을 마지막 페이지까지 조회한다. */
async function getAllEventsByStatus(status, size) {
  const items = []
  let page = 0
  let hasNext = true

  while (hasNext) {
    const result = await get('/api/admin/events', { status, page, size })
    items.push(...(result?.items ?? []))
    hasNext = result?.hasNext === true
    page += 1
  }

  return items
}

/** 지정된 상태 목록을 병렬로 조회해 하나의 이벤트 목록으로 합친다. */
async function getEventsByStatuses(statuses, { size = 100 } = {}) {
  const eventsByStatus = await Promise.all(
    statuses.map((status) => getAllEventsByStatus(status, size)),
  )
  return { items: eventsByStatus.flat() }
}

/** Dashboard와 이벤트 관리 화면에서 추적하는 전체 운영 이벤트를 조회한다. */
export function getDrawingEvents(options) {
  return getEventsByStatuses(OPERATING_EVENT_STATUSES, options)
}

/** 운영 상태별 목록 계약을 합쳐 이벤트 관리 화면의 전체 목록을 제공한다. */
export function getOperatingEvents(options) {
  return getDrawingEvents(options)
}

/** 추첨 콘솔에는 이미 마감된 이벤트만 전달해 이벤트 운영 화면과 책임을 분리한다. */
export function getDrawingReadyEvents(options) {
  return getEventsByStatuses(DRAWING_READY_EVENT_STATUSES, options)
}

/** 단건 조회 계약이 없으므로 운영 상태 목록에서 URL의 이벤트를 찾아 상세를 구성한다. */
export async function getOperatingEvent(eventId) {
  const result = await getOperatingEvents()
  return result.items.find((item) => String(item.eventId) === String(eventId)) ?? null
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
