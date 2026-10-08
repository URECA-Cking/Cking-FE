export const CREATOR_APPLICATION_STATUS_META = { PENDING: { label: '심사 대기', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'hourglass_top' }, APPROVED: { label: '승인됨', tone: 'bg-berry-tint text-primary', icon: 'verified' }, REJECTED: { label: '거절됨', tone: 'bg-error-container text-on-error-container', icon: 'block' } }
export const REVIEW_STATUS_META = {
  PENDING: CREATOR_APPLICATION_STATUS_META.PENDING,
  PENDING_APPROVAL: { label: '승인 대기', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'hourglass_top' },
  APPROVED: CREATOR_APPLICATION_STATUS_META.APPROVED,
  REJECTED: CREATOR_APPLICATION_STATUS_META.REJECTED,
}
const EVENT_STATUS_META = { SCHEDULED: { label: '예정', tone: 'bg-surface-container text-on-surface-variant' }, OPEN: { label: '진행 중', tone: 'bg-berry-tint text-primary' }, CLOSED: { label: '마감 완료', tone: 'bg-surface-container-highest text-on-surface-variant' }, CLOSING: { label: '마감 처리 중', tone: 'bg-gold-badge-bg text-gold-badge' }, DRAW_COMPLETED: { label: '추첨 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed' }, PUBLISHED: { label: '결과 공개', tone: 'bg-berry-tint text-primary' } }
export const EVENT_OPERATION_FLOW = ['OPEN', 'CLOSING', 'CLOSED', 'DRAW_COMPLETED', 'PUBLISHED']
/** 관리자 추첨 화면에서 이벤트 상태를 표시할 문구와 색상을 반환한다. */
export function eventStatusMeta(status) { return EVENT_STATUS_META[status] ?? { label: status ?? '-', tone: 'bg-surface-container text-on-surface-variant' } }
