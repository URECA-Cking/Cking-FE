import { useEffect, useRef, useState } from 'react'

const TRIGGER = 70 // 이만큼 당긴 뒤 놓으면 새로고침
const MAX_PULL = 110
const RESISTANCE = 0.5 // 손가락 이동량 대비 화면에 따라오는 비율
const RELOAD_DELAY = 700 // 왕관이 얹히는 모션을 보여준 뒤 새로고침

/** 터치 지점부터 위로 올라가며 스크롤된 영역(바텀시트 내부 등)이 있으면 true. 그 안의 스크롤을 새로고침으로 오인하지 않는다. */
function isInsideScrolled(el) {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true
  }
  return false
}

/**
 * 화면 맨 위에서 아래로 당기면 기본 로딩바 대신 CKing 로고가 나온다.
 * 당기는 만큼 왕관이 오른쪽 위에서 내려와 몸통에 얹히고(스플래시와 같은 연출), 기준 이상 당겼다 놓으면 새로고침한다.
 * 브라우저 기본 당겨서 새로고침은 index.css의 overscroll-behavior로 막아 둔다. 터치 기기 전용이다.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    function update(value) {
      pullRef.current = value
      setPull(value)
    }

    function onStart(e) {
      const blocked =
        refreshingRef.current ||
        e.touches.length !== 1 ||
        window.scrollY > 0 ||
        document.documentElement.classList.contains('splash-active') ||
        isInsideScrolled(e.target)
      startY.current = blocked ? null : e.touches[0].clientY
    }

    function onMove(e) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current > 0) update(0)
        return
      }
      if (e.cancelable) e.preventDefault()
      update(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    function onEnd() {
      if (startY.current === null) return
      startY.current = null
      if (pullRef.current >= TRIGGER) {
        refreshingRef.current = true
        setRefreshing(true)
        update(TRIGGER)
        setTimeout(() => window.location.reload(), RELOAD_DELAY)
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

  if (pull === 0) return null

  const progress = Math.min(pull / TRIGGER, 1)
  const remain = 1 - progress
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center pt-safe">
      <div
        className="splash-stack relative w-[112px]"
        style={{
          transform: `translateY(${pull - 40}px)`,
          opacity: Math.min(progress * 1.5, 1),
          // 왕관이 얹힌 순간(놓은 뒤)에만 몸통이 눌리는 모션을 쓴다.
          animation: refreshing ? 'splash-stack-bump 220ms ease-out' : undefined,
        }}
      >
        <img src="/cking-logo-body.png" alt="" className="block w-full" />
        <img
          src="/cking-crown.png"
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{
            transformOrigin: '45% 17%',
            transform: `translate(${remain * 40}px, ${-remain * 50}px) rotate(${remain * 22}deg)`,
          }}
        />
      </div>
    </div>
  )
}
