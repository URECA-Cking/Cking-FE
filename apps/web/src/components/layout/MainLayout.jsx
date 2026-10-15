import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useCallback, useLayoutEffect, useRef } from 'react'
import BottomNav from './BottomNav.jsx'
import { TopHeader } from './TopHeader.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useOnline } from '../../hooks/useOnline.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getAllMyNotifications } from '../../api/notifications.js'
import FollowStatus from '../creator/FollowStatus.jsx'
import { useScrollChrome } from '../../hooks/useScrollChrome.js'
import { useAppBack } from '../../hooks/useAppBack.js'
import { useMyTickets } from '../../context/useMyTickets.js'
import {
  resetNavigationScroll,
  restoreNavigationScroll,
  saveNavigationScroll,
  shouldContinueNavigationScrollRestore,
} from './navigationScroll.js'

const APP_BAR_TITLES = {
  '/': { title: 'Cking' },
  '/explore': { title: '탐색', centered: true },
  // back: 홈·스페이스 등 다른 화면에서 들어오므로 뒤로 가기 버튼을 보여준다. hideBell: 이미 알림 화면이라 알림 종 아이콘은 숨긴다.
  '/notifications': { title: '알림', back: true, hideBell: true },
  '/my-entries': { title: '내 응모', centered: true },
  '/my-page': { title: '마이', centered: true },
  // 마이페이지 메뉴와 헤더 응모권 버튼에서 들어온다. 이미 그 화면이라 헤더의 응모권 버튼은 숨긴다.
  '/my-tickets': { title: '내 응모권', back: true, hideTickets: true },
}

/** 사용자 화면의 헤더 배지와 공용 탐색 레이아웃을 관리한다. */
export default function MainLayout() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const { pathname } = location
  const goBack = useAppBack('/')
  const scrollRef = useRef(null)
  const isRestoringScrollRef = useRef(false)
  const restoreFrameRef = useRef(null)
  const { headerVisible, bottomCompact, resetChrome } = useScrollChrome(scrollRef)
  const online = useOnline()
  const appBarTitle = APP_BAR_TITLES[pathname]

  // 헤더 배지는 목록의 모든 페이지를 기준으로 계산한다.
  // 이 레이아웃은 RequireUser 안에서만 렌더링되므로 항상 로그인된 상태에서 조회한다.
  const { data, reload, setData } = useAsync(() => getAllMyNotifications(), [pathname])
  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((item) => !item.readAt).length

  /** 알림 하나의 읽음 상태를 헤더 배지의 목록에도 즉시 반영한다. */
  const markNotificationReadLocally = (notificationId, readAt) => {
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) =>
        item.notificationId === notificationId ? { ...item, readAt } : item,
      ),
    }))
  }

  /** 전체 읽음 요청 동안 헤더 배지의 미확인 개수를 즉시 0으로 만든다. */
  const markAllNotificationsReadLocally = (readAt) => {
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) => item.readAt ? item : { ...item, readAt }),
    }))
  }

  /** 전체 읽음 요청이 실패하면 이번 요청에서 바꾼 배지 상태만 되돌린다. */
  const rollbackAllNotificationsReadLocally = (optimisticReadAt) => {
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) =>
        item.readAt === optimisticReadAt ? { ...item, readAt: null } : item,
      ),
    }))
  }
  // 헤더 응모권 버튼의 총 개수. 아직 불러오지 못했으면 null이라 자리 표시를 보여 준다.
  const { summary: ticketSummary } = useMyTickets()

  /** 현재 history 위치에서 사용자가 읽고 있던 공용 스크롤 위치를 기록한다. */
  const handleScrollPositionSave = useCallback(() => {
    if (isRestoringScrollRef.current) return
    saveNavigationScroll(location.key, scrollRef.current?.scrollTop ?? 0)
  }, [location.key])

  /** 활성 하단 메뉴 재선택 시 현재 history 위치를 최상단으로 초기화한다. */
  const handleNavigationScrollReset = () => resetNavigationScroll(scrollRef.current, location.key, resetChrome)

  /** 복원 대기 중 사용자가 직접 스크롤하려 할 때 RAF를 취소하고 입력을 우선한다. */
  const cancelScrollRestore = useCallback(() => {
    if (!isRestoringScrollRef.current) return
    if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current)
    restoreFrameRef.current = null
    isRestoringScrollRef.current = false
  }, [])

  // 새 화면 진입은 최상단에서 시작하고, POP 뒤로 가기만 비동기 콘텐츠가 늘어날 때까지 제한적으로 위치를 복원한다.
  useLayoutEffect(() => {
    const targetScrollTop = restoreNavigationScroll(scrollRef.current, navigationType, location.key, resetChrome)
    if (navigationType !== 'POP' || targetScrollTop === 0) return undefined

    isRestoringScrollRef.current = true
    let attempt = 0

    /** 콘텐츠 높이가 아직 부족해 목표 위치에 닿지 못하면 다음 프레임에 다시 복원한다. */
    const restoreUntilReady = () => {
      const scrollContainer = scrollRef.current
      if (!scrollContainer) {
        isRestoringScrollRef.current = false
        return
      }

      scrollContainer.scrollTop = targetScrollTop
      resetChrome(scrollContainer.scrollTop)
      if (!shouldContinueNavigationScrollRestore(targetScrollTop, scrollContainer.scrollTop, attempt)) {
        isRestoringScrollRef.current = false
        restoreFrameRef.current = null
        return
      }

      attempt += 1
      restoreFrameRef.current = window.requestAnimationFrame(restoreUntilReady)
    }

    restoreFrameRef.current = window.requestAnimationFrame(restoreUntilReady)
    return () => {
      cancelScrollRestore()
    }
  }, [cancelScrollRestore, location.key, navigationType, resetChrome])

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      {appBarTitle && (
        <TopHeader
          title={appBarTitle.title}
          centered={appBarTitle.centered}
          unreadCount={unreadCount}
          embedded
          hidden={!headerVisible}
          onBack={appBarTitle.back ? goBack : undefined}
          showNotificationBell={!appBarTitle.hideBell}
          showTicketButton={!appBarTitle.hideTickets}
          ticketCount={ticketSummary ? ticketSummary.total : null}
        />
      )}
      <main
        ref={scrollRef}
        onScroll={handleScrollPositionSave}
        onWheel={cancelScrollRestore}
        onTouchStart={cancelScrollRestore}
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] ${
          appBarTitle ? 'pt-[calc(env(safe-area-inset-top,0px)+3.5rem)]' : 'pt-safe'
        }`}
      >
        <FollowStatus />
        {!online && (
          <div className="mx-margin mt-space-sm flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-badge-bg text-gold-badge">
            <MaterialIcon name="wifi_off" className="text-[18px]" />
            <span className="font-label-xs text-label-xs font-semibold">
              오프라인 상태예요. 마지막으로 불러온 내용을 보여주고 있어요.
            </span>
          </div>
        )}
        <Outlet context={{
          notifications,
          unreadCount,
          reloadNotifications: reload,
          markNotificationReadLocally,
          markAllNotificationsReadLocally,
          rollbackAllNotificationsReadLocally,
        }} />
      </main>
      <BottomNav embedded compact={bottomCompact} onNavigate={handleNavigationScrollReset} />
    </div>
  )
}
