import { Link } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'

// /live/* 화면들에서 공통으로 쓰는 상태 표시용 작은 컴포넌트 모음.
// 실제 백엔드 응답을 그대로 보여주는 "기능 확인용" 화면이라 디자인은 최소한으로 유지한다.

export const DISPLAY_STATUS_LABEL = {
  UPCOMING: { label: '오픈 예정', className: 'bg-surface-container text-on-surface-variant' },
  IN_PROGRESS: { label: '진행 중', className: 'bg-primary text-on-primary' },
  CLOSED: { label: '종료', className: 'bg-outline-variant/30 text-on-surface-variant' },
}

export const NOTIFICATION_TYPE_LABEL = {
  INITIAL_WINNER: '최초 당첨',
  REDRAW_WINNER: '재추첨 당첨',
}

export const CREATOR_APPLICATION_STATUS_LABEL = {
  PENDING: { label: '심사 대기', className: 'bg-surface-container text-on-surface-variant' },
  APPROVED: { label: '승인됨', className: 'bg-berry-tint text-primary' },
  REJECTED: { label: '거절됨', className: 'bg-outline-variant/30 text-on-surface-variant' },
}

export function StatusPill({ label, className = 'bg-surface-container text-on-surface-variant' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-label-xs text-label-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

export function LoadingBlock({ label = '불러오는 중...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-space-xl text-on-surface-variant">
      <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
      </svg>
      <span className="font-label-sm text-label-sm">{label}</span>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-space-xl px-margin text-center">
      <MaterialIcon name="error" className="text-[28px] text-primary" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">{message}</p>
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

export function EmptyBlock({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-space-xl text-center text-on-surface-variant">
      <MaterialIcon name="inbox" className="text-[26px]" />
      <p className="font-body-sm text-body-sm">{message}</p>
    </div>
  )
}

// 데모 사용자가 선택되지 않았을 때 공통으로 보여주는 안내 카드.
export function UserGate({ user, children }) {
  if (user) return children
  return (
    <div className="mx-margin mt-space-md p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm items-start">
      <div className="flex items-center gap-2 text-primary">
        <MaterialIcon name="account_circle" className="text-[22px]" />
        <span className="font-title-md text-title-md font-bold text-on-surface">먼저 데모 사용자를 선택해주세요</span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        모든 API 호출에는 userId가 필요해요. /live 홈에서 가상 사용자를 하나 골라주세요.
      </p>
      <Link
        to="/live"
        className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-95 transition-all"
      >
        사용자 선택하러 가기
      </Link>
    </div>
  )
}

export function formatDateTime(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
