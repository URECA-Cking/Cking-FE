/** 백엔드 DisplayStatus / EventStatus를 화면 문구·색으로 옮기는 매핑. */

export const DISPLAY_STATUS_META = {
  UPCOMING: { label: '오픈 예정', tone: 'bg-tertiary-fixed text-on-tertiary-fixed', icon: 'schedule' },
  IN_PROGRESS: { label: '진행 중', tone: 'bg-primary text-on-primary', icon: 'bolt' },
  CLOSED: { label: '종료', tone: 'bg-surface-container-highest text-on-surface-variant', icon: 'lock' },
}

export const EVENT_STATUS_META = {
  DRAFT: { label: '초안', tone: 'bg-surface-container-high text-on-surface-variant' },
  PENDING_APPROVAL: { label: '승인 대기', tone: 'bg-gold-badge-bg text-gold-badge' },
  REJECTED: { label: '거절됨', tone: 'bg-error-container text-on-error-container' },
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
}

export const TICKET_LEDGER_TYPE_META = {
  EARN: { label: '적립', icon: 'add_circle', tone: 'text-secondary' },
  SPEND: { label: '응모 사용', icon: 'confirmation_number', tone: 'text-primary' },
  COMPENSATE: { label: '보상 반환', icon: 'undo', tone: 'text-tertiary' },
}

export function displayStatusMeta(status) {
  return DISPLAY_STATUS_META[status] ?? DISPLAY_STATUS_META.CLOSED
}

export function eventStatusMeta(status) {
  return EVENT_STATUS_META[status] ?? { label: status ?? '-', tone: 'bg-surface-container text-on-surface-variant' }
}

/** 응모 가능 여부: 백엔드는 OPEN 상태이고 종료 전인 이벤트에만 응모를 허용한다. */
export function isEntryOpen(event) {
  if (!event) return false
  return event.displayStatus === 'IN_PROGRESS' && event.status === 'OPEN'
}

/** 결과가 공개된 이벤트인지(당첨자 조회 가능). */
export function isPublished(event) {
  return event?.status === 'PUBLISHED'
}
