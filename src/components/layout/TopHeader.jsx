import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useToast } from '../../context/ToastContext.jsx'

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

/** Top app bar used on the main tab screens (Home, Explore). */
export function TopHeader({ title }) {
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <Link to="/" className="text-primary font-headline-md text-headline-md tracking-tight font-bold">
            Cking
          </Link>
          <div className="h-4 w-[1px] bg-outline-variant/30" />
          <h1 className="text-on-surface font-title-md text-title-md truncate max-w-[180px]">{title}</h1>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            aria-label="검색"
            onClick={() => navigate('/explore')}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            type="button"
          >
            <MaterialIcon name="search" className="text-[22px]" />
          </button>
          <Link
            to="/my-page"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
            aria-label="마이페이지"
          >
            <MaterialIcon name="person" className="text-on-primary text-[18px]" />
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
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 px-margin flex items-center justify-between gap-space-sm">
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
