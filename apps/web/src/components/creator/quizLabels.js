// 내 Quiz 목록과 검토 시트가 함께 쓰는 상태 표시.

export const PUBLICATION_LABELS = {
  NOT_PUBLISHED: { label: '미게시', icon: 'visibility_off', tone: 'bg-surface-container text-on-surface-variant' },
  PUBLISHED: { label: '게시 중', icon: 'public', tone: 'bg-primary text-on-primary' },
  UNPUBLISHED: { label: '게시 중지', icon: 'pause_circle', tone: 'bg-surface-container-high text-on-surface' },
}

export const REVIEW_LABELS = {
  PENDING_REVIEW: { label: '검토 대기', icon: 'rate_review', tone: 'bg-surface-container-high text-on-surface' },
  APPROVED: { label: '승인됨', icon: 'verified', tone: 'bg-primary/10 text-primary' },
  REJECTED: { label: '반려됨', icon: 'block', tone: 'bg-error-container text-on-error-container' },
}
