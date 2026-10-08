import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useToast } from '../../context/useToast.js'

/** 현재 화면 주소를 공유한다. Web Share API가 없으면 클립보드로 복사한다. */
function useShare() {
  const showToast = useToast()
  return async (title) => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: title ?? 'Cking', url })
        return
      }
      await navigator.clipboard.writeText(url)
      showToast('링크를 복사했어요.')
    } catch (error) {
      // 사용자가 공유 시트를 닫은 경우(AbortError)는 알림을 띄우지 않는다.
      if (error?.name !== 'AbortError') showToast('공유할 수 없는 환경이에요.', { icon: 'error' })
    }
  }
}

/** Main-tab app bar. Its centered title is intentionally independent from the right action. */
export function TopHeader({ title, centered = false, unreadCount = 0, embedded = false, hidden = false }) {
  return (
    <header
      className={
        embedded
          ? `fixed top-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 pt-safe transition-[transform,opacity] duration-300 ease-out md:max-w-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[calc(env(safe-area-inset-top,0px)+3.5rem)] before:bg-gradient-to-b before:from-surface/[0.22] before:via-surface/[0.08] before:to-transparent before:backdrop-blur-[2px] before:content-[''] ${
              hidden ? '-translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
            }`
          : 'fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
      }
      inert={hidden ? '' : undefined}
    >
      <div
        className={
          embedded
            ? 'relative h-14 px-margin flex items-center justify-between md:px-8'
            : 'h-14 px-margin md:px-8 flex items-center justify-between'
        }
      >
        {centered ? (
          <h1 className="absolute left-1/2 -translate-x-1/2 text-on-surface font-title-md text-title-md">{title}</h1>
        ) : (
          <div className="flex items-center gap-space-sm">
            <Link to="/" aria-label="Cking 홈">
              <img src="/cking-logo.png" alt="Cking" className="block h-10 w-auto" />
            </Link>
            {title !== 'Cking' && (
              <>
                <div className="h-4 w-[1px] bg-outline-variant/30" />
                <h1 className="text-on-surface font-title-md text-title-md truncate max-w-[180px]">{title}</h1>
              </>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center">
          <Link
            to="/notifications"
            className="relative w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="알림"
          >
            <MaterialIcon name="notifications" className="text-[22px]" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error font-label-xs text-[10px] leading-4 text-center font-bold"
                aria-label={`읽지 않은 알림 ${unreadCount}개`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Header with a back button, used on detail / sub screens. */
export function BackHeader({ title, badge, onBack, right }) {
  const share = useShare()

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 px-margin md:px-8 flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <button
            aria-label="뒤로가기"
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface shrink-0"
            onClick={onBack ?? (() => window.history.back())}
            type="button"
          >
            <MaterialIcon name="arrow_back" className="text-[22px]" />
          </button>
          <h1 className="font-title-md text-title-md text-on-surface font-semibold truncate">{title}</h1>
        </div>
        {badge ? (
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-berry-tint border border-border-rose shrink-0">
            <MaterialIcon name="stars" filled className="text-label-xs text-primary" />
            <span className="font-label-xs text-label-xs text-primary font-semibold">{badge}</span>
          </div>
        ) : (
          (right ?? (
            <div className="flex items-center gap-space-xs shrink-0">
              <button
                aria-label="공유하기"
                onClick={() => share(title)}
                className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                type="button"
              >
                <MaterialIcon name="share" className="text-[20px]" />
              </button>
              <Link
                to="/my-page"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                aria-label="마이페이지"
              >
                <MaterialIcon name="person" className="text-on-primary text-[18px]" />
              </Link>
            </div>
          ))
        )}
      </div>
    </header>
  )
}
