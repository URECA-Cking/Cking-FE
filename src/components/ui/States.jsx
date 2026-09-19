import { Link } from 'react-router-dom'
import MaterialIcon from './MaterialIcon.jsx'

/** 목록/상세 화면에서 공통으로 쓰는 로딩·오류·빈 상태 표시. */

export function Spinner({ className = 'w-6 h-6 text-primary' }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      />
    </svg>
  )
}

export function LoadingBlock({ label = '불러오는 중...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-space-xl text-on-surface-variant" role="status">
      <Spinner />
      <span className="font-label-sm text-label-sm">{label}</span>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-space-xl px-margin text-center">
      <MaterialIcon name="error" className="text-[28px] text-primary" />
      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}

export function EmptyBlock({ message, icon = 'inbox', action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-space-xl px-margin text-center text-on-surface-variant">
      <MaterialIcon name={icon} className="text-[28px] text-outline" />
      <p className="font-body-sm text-body-sm">{message}</p>
      {action}
    </div>
  )
}

export function StatusPill({ label, tone = 'bg-surface-container text-on-surface-variant', icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-xs text-label-xs font-semibold ${tone} ${className}`}
    >
      {icon && <MaterialIcon name={icon} className="text-[13px]" />}
      {label}
    </span>
  )
}

export function SectionHeader({ icon, title, count, action, actionTo, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <MaterialIcon name={icon} className="text-[20px] text-primary" />}
        <h3 className="font-title-md text-title-md text-on-surface font-bold truncate">{title}</h3>
        {count !== undefined && count !== null && (
          <span className="font-label-xs text-label-xs bg-surface-container-high text-primary px-2 py-0.5 rounded-full font-bold shrink-0">
            {count}
          </span>
        )}
      </div>
      {action && actionTo && (
        <Link
          to={actionTo}
          className="flex items-center text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm shrink-0"
        >
          {action}
          <MaterialIcon name="chevron_right" className="text-[16px]" />
        </Link>
      )}
      {action && !actionTo && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm shrink-0"
        >
          {action}
          <MaterialIcon name="chevron_right" className="text-[16px]" />
        </button>
      )}
    </div>
  )
}

