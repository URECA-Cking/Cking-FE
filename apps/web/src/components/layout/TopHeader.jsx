import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import ThemedImage from '../ui/ThemedImage.jsx'
import BackButton from '../ui/BackButton.jsx'
import { useToast } from '../../context/useToast.js'
import { formatTicketBadge } from '../../utils/myTickets.js'

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

/**
 * 메인 탭 앱바를 표시한다. 가운데 제목은 오른쪽 동작 버튼과 독립적으로 배치한다.
 * - onBack: 왼쪽에 뒤로 가기 버튼을 보여준다. centered와 함께 주면 제목은 가운데에 두고, 아니면 버튼 옆에 둔다(로고 대신).
 * - showNotificationBell: 오른쪽 알림 종 아이콘. 알림 화면처럼 이미 그 화면이면 false로 숨긴다.
 * - unreadCountPartial: 전체 개수 API가 없어 최근 100건만 셌을 때 하한값으로 표시한다.
 * - showTicketButton / ticketCount: 알림 종 왼쪽의 응모권 버튼과 현재 총 응모권 개수. 개수를 아직 모르면(null) 자리 표시를 보여 준다.
 *   내 응모권 화면처럼 이미 그 화면이면 false로 숨긴다.
 */
export function TopHeader({
  title,
  centered = false,
  unreadCount = 0,
  unreadCountPartial = false,
  embedded = false,
  hidden = false,
  onBack,
  showNotificationBell = true,
  showTicketButton = true,
  ticketCount = null,
}) {
  return (
    <header
      className={
        embedded
          ? `fixed top-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 pt-safe transition-[transform,opacity] duration-300 ease-out md:max-w-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[calc(env(safe-area-inset-top,0px)+3.5rem)] before:bg-gradient-to-b before:from-surface/[0.22] before:via-surface/[0.08] before:to-transparent before:backdrop-blur-[2px] before:content-[''] ${
              hidden ? '-translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
            }`
          : 'fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
      }
      inert={hidden}
    >
      <div
        className={
          embedded
            ? 'relative h-14 px-margin flex items-center justify-between md:px-8'
            : 'h-14 px-margin md:px-8 flex items-center justify-between'
        }
      >
        {centered ? (
          <>
            {onBack && <BackButton onClick={onBack} />}
            <h1 className="absolute left-1/2 -translate-x-1/2 text-on-surface font-title-md text-title-md">{title}</h1>
          </>
        ) : onBack ? (
          <div className="flex min-w-0 items-center gap-space-xs">
            <BackButton onClick={onBack} />
            <h1 className="truncate text-on-surface font-title-md text-title-md font-semibold">{title}</h1>
          </div>
        ) : (
          <div className="flex items-center gap-space-sm">
            <Link to="/" aria-label="Cking 홈">
              <ThemedImage dark="/cking-logo.png" light="/cking-logo-light.png" alt="Cking" className="h-10 w-auto" />
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
          {showTicketButton && (
            <Link
              to="/my-tickets"
              className="h-11 px-2 flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label={ticketCount === null ? '내 응모권' : `내 응모권 ${ticketCount}장`}
            >
              <MaterialIcon name="confirmation_number" className="text-[22px]" />
              <span className="font-label-sm text-label-sm font-semibold tabular-nums text-on-surface">
                {ticketCount === null ? '–' : formatTicketBadge(ticketCount)}
              </span>
            </Link>
          )}
          {showNotificationBell && (
            <Link
              to="/notifications"
              className="relative w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="알림"
            >
              <MaterialIcon name="notifications" className="text-[26px]" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-0.5 left-1/2 ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary font-label-xs text-[11px] leading-5 text-center font-bold tabular-nums"
                  aria-label={`${unreadCountPartial ? '최근 100건 중 ' : ''}읽지 않은 알림 ${unreadCount}개${unreadCountPartial ? ' 이상' : ''}`}
                >
                  {unreadCount > 99 ? '99+' : unreadCountPartial ? `${unreadCount}+` : unreadCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Header with a back button, used on detail / sub screens. */
export function BackHeader({ title, badge, onBack, right, showShare = true }) {
  const share = useShare()

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 px-margin md:px-8 flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <BackButton onClick={onBack ?? (() => window.history.back())} />
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
              {showShare && <button
                aria-label="공유하기"
                onClick={() => share(title)}
                className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                type="button"
              >
                <MaterialIcon name="share" className="text-[20px]" />
              </button>}
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
