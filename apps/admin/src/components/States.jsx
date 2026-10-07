import MaterialIcon from './MaterialIcon.jsx'
/** 로딩 중인 영역을 표시한다. */
export function LoadingBlock({ label = '불러오는 중...' }) { return <div className="py-space-xl text-center text-label-sm text-on-surface-variant" role="status">{label}</div> }
/** 재시도할 수 있는 오류 영역을 표시한다. */
export function ErrorBlock({ message, onRetry }) { return <div className="py-space-xl text-center"><p className="text-body-sm text-on-surface-variant">{message}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-2 rounded-xl bg-surface-container px-4 py-2 text-label-sm text-on-surface">다시 시도</button>}</div> }
/** 데이터가 없을 때의 빈 상태 영역을 표시한다. */
export function EmptyBlock({ message, icon = 'inbox' }) { return <div className="py-space-xl text-center text-on-surface-variant"><MaterialIcon name={icon} className="text-[28px]" /><p className="text-body-sm">{message}</p></div> }
/** 상태를 색상 칩으로 표시한다. */
export function StatusPill({ label, tone = 'bg-surface-container text-on-surface-variant', icon, className = '' }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-xs ${tone} ${className}`} >{icon && <MaterialIcon name={icon} className="text-[13px]" />}{label}</span> }
