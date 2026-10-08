import MaterialIcon from "./MaterialIcon.jsx";
import {
  REVIEW_STATUS_META,
  drawingStatusMeta,
  eventStatusMeta,
  verificationStatusMeta,
} from "../utils/eventStatus.js";

const REDRAW_REVIEW_META = {
  REQUESTED: { label: '검토 대기', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'hourglass_top' },
  APPROVED: { label: '승인', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
  REJECTED: { label: '거절', tone: 'bg-error-container text-on-error-container', icon: 'cancel' },
};
const REDRAW_EXECUTION_META = {
  PENDING: { label: '실행 대기', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'schedule' },
  EXECUTED: { label: '실행 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'task_alt' },
  FAILED: { label: '실행 실패', tone: 'bg-error-container text-on-error-container', icon: 'error' },
  INSUFFICIENT_CANDIDATES: { label: '후보 부족', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'group_off' },
};

/** 심사·운영 화면의 상태 라벨과 색상을 한곳에서 일관되게 표시한다. */
export default function StatusBadge({ status, type = "auto", className = "" }) {
  const meta =
    type === "review"
      ? (REVIEW_STATUS_META[status] ?? eventStatusMeta(status))
      : type === "redraw-review"
        ? (REDRAW_REVIEW_META[status] ?? eventStatusMeta(status))
        : type === "redraw-execution"
          ? (REDRAW_EXECUTION_META[status] ?? eventStatusMeta(status))
      : type === "drawing"
        ? drawingStatusMeta(status)
        : type === "verification"
          ? verificationStatusMeta(status)
          : (REVIEW_STATUS_META[status] ?? eventStatusMeta(status));
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-xs ${meta.tone} ${className}`}
    >
      {meta.icon && <MaterialIcon name={meta.icon} className="text-[13px]" />}
      {meta.label}
    </span>
  );
}
