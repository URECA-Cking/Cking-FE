import MaterialIcon from "./MaterialIcon.jsx";
import {
  REVIEW_STATUS_META,
  drawingStatusMeta,
  eventStatusMeta,
  verificationStatusMeta,
} from "../utils/eventStatus.js";

/** 심사·운영 화면의 상태 라벨과 색상을 한곳에서 일관되게 표시한다. */
export default function StatusBadge({ status, type = "auto", className = "" }) {
  const meta =
    type === "review"
      ? (REVIEW_STATUS_META[status] ?? eventStatusMeta(status))
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
