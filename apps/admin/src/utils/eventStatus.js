export const CREATOR_APPLICATION_STATUS_META = {
  PENDING: {
    label: "심사 대기",
    tone: "bg-gold-badge-bg text-gold-badge",
    icon: "hourglass_top",
  },
  APPROVED: {
    label: "승인됨",
    tone: "bg-berry-tint text-primary",
    icon: "verified",
  },
  REJECTED: {
    label: "거절됨",
    tone: "bg-error-container text-on-error-container",
    icon: "block",
  },
};
export const REVIEW_STATUS_META = {
  PENDING: CREATOR_APPLICATION_STATUS_META.PENDING,
  PENDING_APPROVAL: {
    label: "승인 대기",
    tone: "bg-gold-badge-bg text-gold-badge",
    icon: "hourglass_top",
  },
  APPROVED: CREATOR_APPLICATION_STATUS_META.APPROVED,
  REJECTED: CREATOR_APPLICATION_STATUS_META.REJECTED,
};
const EVENT_STATUS_META = {
  SCHEDULED: {
    label: "예정",
    tone: "bg-surface-container text-on-surface-variant",
  },
  OPEN: { label: "진행 중", tone: "bg-berry-tint text-primary" },
  CLOSED: {
    label: "마감 완료",
    tone: "bg-surface-container-highest text-on-surface-variant",
  },
  CLOSING: { label: "마감 처리 중", tone: "bg-gold-badge-bg text-gold-badge" },
  DRAW_COMPLETED: {
    label: "추첨 완료",
    tone: "bg-secondary-fixed text-on-secondary-fixed",
  },
  PUBLISHED: { label: "결과 공개", tone: "bg-berry-tint text-primary" },
};
const DRAWING_STATUS_META = {
  PENDING: { label: "대기 중", tone: "bg-gold-badge-bg text-gold-badge" },
  RUNNING: { label: "실행 중", tone: "bg-berry-tint text-primary" },
  COMPLETED: {
    label: "완료",
    tone: "bg-secondary-fixed text-on-secondary-fixed",
  },
  FAILED: { label: "실패", tone: "bg-error-container text-on-error-container" },
};
const VERIFICATION_STATUS_META = {
  VERIFIED: {
    label: "검증 완료",
    tone: "bg-secondary-fixed text-on-secondary-fixed",
    icon: "verified",
  },
  VERIFICATION_FAILED: {
    label: "검증 실패",
    tone: "bg-error-container text-on-error-container",
    icon: "warning",
  },
};
export const WINNER_STATUS_META = {
  SELECTED: { label: "당첨", tone: "bg-berry-tint text-primary", icon: "workspace_premium" },
  RECEIVED: { label: "수령 완료", tone: "bg-secondary-fixed text-on-secondary-fixed", icon: "check_circle" },
  DECLINED: { label: "당첨 포기", tone: "bg-surface-container-high text-on-surface-variant", icon: "block" },
  DISQUALIFIED: { label: "자격 박탈", tone: "bg-error-container text-on-error-container", icon: "gpp_bad" },
};
export const EVENT_OPERATION_FLOW = [
  "OPEN",
  "CLOSING",
  "CLOSED",
  "DRAW_COMPLETED",
  "PUBLISHED",
];
/** 관리자 추첨 화면에서 이벤트 상태를 표시할 문구와 색상을 반환한다. */
export function eventStatusMeta(status) {
  return (
    EVENT_STATUS_META[status] ?? {
      label: status ?? "-",
      tone: "bg-surface-container text-on-surface-variant",
    }
  );
}
/** Drawing 실행 상태를 이벤트 상태와 분리해 표시한다. */
export function drawingStatusMeta(status) {
  return (
    DRAWING_STATUS_META[status] ?? {
      label: status ?? "-",
      tone: "bg-surface-container text-on-surface-variant",
    }
  );
}
/** 추첨 재현 검증 결과를 표시한다. */
export function verificationStatusMeta(status) {
  return (
    VERIFICATION_STATUS_META[status] ?? {
      label: status ?? "-",
      tone: "bg-surface-container text-on-surface-variant",
    }
  );
}
/** 당첨자 관리 상태를 운영 화면 전체에서 동일한 문구와 색상으로 표시한다. */
export function winnerStatusMeta(status) {
  return WINNER_STATUS_META[status] ?? { label: status ?? "상태 확인 필요", tone: "bg-surface-container text-on-surface-variant" };
}
