/** 백엔드 DisplayStatus / EventStatus를 화면 문구·색으로 옮기는 매핑. */

export const DISPLAY_STATUS_META = {
  UPCOMING: { label: '오픈 예정', tone: 'bg-tertiary-fixed text-on-tertiary-fixed', icon: 'schedule' },
  IN_PROGRESS: { label: '진행 중', tone: 'bg-primary text-on-primary', icon: 'bolt' },
  CLOSED: { label: '종료', tone: 'bg-surface-container-highest text-on-surface-variant', icon: 'lock' },
}

export const EVENT_STATUS_META = {
  DRAFT: { label: '초안', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'edit_note' },
  PENDING_APPROVAL: { label: '승인 대기', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'hourglass_top' },
  REJECTED: { label: '거절됨', tone: 'bg-error-container text-on-error-container', icon: 'block' },
  SCHEDULED: { label: '오픈 예정', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  OPEN: { label: '응모 진행 중', tone: 'bg-primary text-on-primary' },
  CLOSING: { label: '마감 처리 중', tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  CLOSED: { label: '마감됨', tone: 'bg-surface-container-highest text-on-surface-variant' },
  DRAW_COMPLETED: { label: '추첨 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  PUBLISHED: { label: '결과 공개', tone: 'bg-berry-tint text-primary' },
}

export const CREATOR_APPLICATION_STATUS_META = {
  PENDING: { label: '심사 대기', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'hourglass_top' },
  APPROVED: { label: '승인됨', tone: 'bg-berry-tint text-primary', icon: 'verified' },
  REJECTED: { label: '거절됨', tone: 'bg-error-container text-on-error-container', icon: 'block' },
}

export const NOTIFICATION_TYPE_META = {
  INITIAL_WINNER: { label: '최초 당첨', icon: 'celebration' },
  REDRAW_WINNER: { label: '재추첨 당첨', icon: 'autorenew' },
  INITIAL_NON_WINNER: { label: '이벤트 결과 발표', icon: 'campaign' },
  COMMENT_RESTRICTION_STARTED: { label: '댓글 작성 제한', icon: 'comments_disabled' },
  COMMENT_RESTRICTION_RELEASED: { label: '댓글 작성 제한 해제', icon: 'forum' },
  COMMON_TICKET_REWARDED: { label: '공용 응모권 지급', icon: 'confirmation_number' },
  CREATOR_TICKET_REWARDED: { label: '크리에이터 응모권 지급', icon: 'local_activity' },
}

export const TICKET_LEDGER_TYPE_META = {
  EARN: { label: '적립', icon: 'add_circle', tone: 'text-success-text' },
  SPEND: { label: '사용', icon: 'confirmation_number', tone: 'text-primary' },
  COMPENSATE: { label: '보상 반환', icon: 'undo', tone: 'text-tertiary' },
}

export function displayStatusMeta(status) {
  return DISPLAY_STATUS_META[status] ?? DISPLAY_STATUS_META.CLOSED
}

export function eventStatusMeta(status) {
  return EVENT_STATUS_META[status] ?? { label: status ?? '-', tone: 'bg-surface-container text-on-surface-variant' }
}

/**
 * 크리에이터 본인 목록(GET /api/creator/events)의 이벤트에는 표시 상태(displayStatus)가 없어서 공개 API와 같은 규칙으로 구한다.
 * 아직 공개되지 않은 상태(초안·승인 대기·거절됨)는 null이다.
 */
export function toDisplayStatus(event, now = Date.now()) {
  switch (event?.status) {
    case 'SCHEDULED':
      return 'UPCOMING'
    case 'OPEN':
      return new Date(event.endAt).getTime() > now ? 'IN_PROGRESS' : 'CLOSED'
    case 'CLOSING':
    case 'CLOSED':
    case 'DRAW_COMPLETED':
    case 'PUBLISHED':
      return 'CLOSED'
    default:
      return null
  }
}

/**
 * 마감된 이벤트의 마감 시각. 자동·수동 마감 모두 마감 요청 시각(closeRequestedAt)을 쓰고,
 * 값이 없으면(마감 전 상태나 필드 도입 전에 마감된 이벤트) 예정 종료일(endAt)로 대체한다.
 */
export function closedDisplayAt(event) {
  return event?.closeRequestedAt ?? event?.endAt
}

/** 응모 가능 여부: 백엔드는 OPEN 상태이고 종료 전인 이벤트에만 응모를 허용한다. */
export function isEntryOpen(event) {
  if (!event) return false
  return event.displayStatus === 'IN_PROGRESS' && event.status === 'OPEN'
}
