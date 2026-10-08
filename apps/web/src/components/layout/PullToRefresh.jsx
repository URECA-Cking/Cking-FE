import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { markSkipSplash } from '../../utils/splashState.js'

const TRIGGER = 70 // 이만큼 당긴 뒤 놓으면 새로고침
const MAX_PULL = 110
const RESISTANCE = 0.5 // 손가락 이동량 대비 화면에 따라오는 비율
// 첫 화면(로그인)은 스플래시가 이어지는 화면이라 당겨서 새로고침을 쓰지 않는다.
const DISABLED_PATHS = ['/login']
const RELOAD_DELAY = 900 // 스플래시와 같은 왕관 낙하(620ms)·눌림 모션이 끝난 뒤 새로고침

/** 터치 지점부터 위로 올라가며 스크롤된 영역(바텀시트 내부 등)이 있으면 true. 그 안의 스크롤을 새로고침으로 오인하지 않는다. */
function isInsideScrolled(el) {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true
  }
  return false
}

/**
 * 화면 맨 위에서 아래로 당기면 앱 화면 전체(#root)가 손가락을 따라 내려오고, 비워진 윗자리에 CKing 로고가 나온다.
 * 당기는 동안은 몸통만 보이고, 기준 이상 당겼다 놓으면 스플래시와 같은 왕관 낙하 연출(index.css의 splash-crown-drop)이 나온 뒤 새로고침한다.
 * 첫 화면(/login)에서는 쓰지 않는다. 별도 화면을 덮지 않고, 새로고침 뒤에도 스플래시는 건너뛴다(splashState). 터치 기기 전용이다.
 * 브라우저 기본 당겨서 새로고침은 index.css의 overscroll-behavior로 막아 둔다.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { pathname } = useLocation()
  const pathnameRef = useRef(pathname)
  const startY = useRef(null)
  const startX = useRef(0)
  // 터치마다 첫 이동에서 한 번 정한다: 가로 이동이 더 크면 가로 스와이프로 보고 이번 터치는 건드리지 않는다.
  const axisLocked = useRef(false)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    function update(value) {
      pullRef.current = value
      setPull(value)
    }

    function onStart(e) {
      const blocked =
        refreshingRef.current ||
        DISABLED_PATHS.includes(pathnameRef.current) ||
        e.touches.length !== 1 ||
        window.scrollY > 0 ||
        document.documentElement.classList.contains('splash-active') ||
        isInsideScrolled(e.target)
      startY.current = blocked ? null : e.touches[0].clientY
      startX.current = e.touches[0].clientX
      axisLocked.current = false
    }

    function onMove(e) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (!axisLocked.current) {
        const dx = e.touches[0].clientX - startX.current
        if (dx === 0 && dy === 0) return
        // 홈의 가로 스크롤 영역을 넘기다 손가락이 살짝 내려가도 당겨서 새로고침으로 오인하지 않게 한다.
        if (Math.abs(dx) > Math.abs(dy)) {
          startY.current = null
          return
        }
        axisLocked.current = true
      }
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current > 0) update(0)
        setDragging(false)
        return
      }
      if (e.cancelable) e.preventDefault()
      setDragging(true)
      update(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    function onEnd() {
      if (startY.current === null) return
      startY.current = null
      setDragging(false)
      if (pullRef.current >= TRIGGER) {
        refreshingRef.current = true
        setRefreshing(true)
        update(TRIGGER)
        setTimeout(() => {
          markSkipSplash()
          window.location.reload()
        }, RELOAD_DELAY)
      } else {
        update(0)
      }
    }

    // preventDefault가 먹으려면 touchmove는 passive: false여야 한다.
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // 앱 화면 전체를 pull만큼 내린다. #root 안의 하단 네비게이션은 같은 거리만큼 반대로 보정해 화면 하단에 둔다.
  // 손가락을 따라올 때는 즉시, 놓았을 때는 부드럽게 움직인다.
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return undefined
    root.style.transition = dragging ? 'none' : 'transform 220ms ease-out'
    root.style.transform = pull > 0 ? `translateY(${pull}px)` : ''
    root.style.setProperty('--pull-fixed-offset', `${-pull}px`)
    root.style.setProperty('--pull-offset-duration', dragging ? '0ms' : '220ms')
    return () => {
      root.style.transform = ''
      root.style.transition = ''
      root.style.removeProperty('--pull-fixed-offset')
      root.style.removeProperty('--pull-offset-duration')
    }
  }, [pull, dragging])

  if (pull === 0) return null

  const progress = Math.min(pull / TRIGGER, 1)
  // #root가 transform을 갖는 동안 그 안의 fixed 요소는 같이 움직이므로, 로고는 body에 직접 붙여 비워진 윗자리에 둔다.
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-0 flex items-center justify-center overflow-hidden"
      style={{ height: pull, transition: dragging ? 'none' : 'height 220ms ease-out' }}
    >
      <div
        className="splash-stack relative w-[112px] shrink-0"
        style={{
          opacity: Math.min(progress * 1.5, 1),
          animation: refreshing ? 'splash-stack-bump 220ms ease-out 340ms' : undefined,
        }}
      >
        <img src="/cking-logo-body.png" alt="" className="block w-full" />
        {/* 왕관은 당기는 중엔 숨겨 두고(opacity 0), 놓은 뒤 스플래시와 같은 키프레임으로 떨어진다. */}
        <img
          src="/cking-crown.png"
          alt=""
          className="absolute inset-0 h-full w-full opacity-0"
          style={{
            transformOrigin: '45% 17%',
            animation: refreshing ? 'splash-crown-drop 620ms cubic-bezier(0.5, 0, 0.75, 0.4) forwards' : undefined,
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
