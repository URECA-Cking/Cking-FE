import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUser } from '../../context/useUser.js'

// 스플래시가 떠 있는 동안 아래 화면의 로고를 숨기는 표식(index.css). 로고가 두 개로 겹쳐 보이지 않게 한다.
const ACTIVE_CLASS = 'splash-active'

/**
 * 페이지를 새로 열 때마다(새로고침 포함) 스플래시를 먼저 보여준다.
 * OAuth 콜백은 로그인 도중 거쳐 가는 화면이라 진입으로 보지 않고, 모션 줄이기 설정 사용자는 건너뛴다.
 */
function shouldShowSplash() {
  if (window.location.pathname.startsWith('/oauth/callback')) return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * 임시 첫 화면: CKing 로고 몸통이 나타나고 왕관이 떨어져 씌워진 뒤(intro),
 * 로그인 상태 확인이 끝나 아래 화면이 정해지면 `data-splash-target` 로고가 있을 때 그 자리로 옮겨 가며 배경이 걷히고(dock),
 * 없으면(로그인된 사용자의 새로고침 등) CKing만 흐려지며 사라진다(out).
 * 로그인이 확인되면(is-over) 배경을 투명하게 풀어, 홈은 그대로 보이고 그 위에 CKing만 떠 있다 사라진다. 키프레임은 index.css의 splash-*.
 */
export default function Splash() {
  const [phase, setPhase] = useState(() => (shouldShowSplash() ? 'intro' : 'done'))
  const [introEnded, setIntroEnded] = useState(false)
  const { status } = useUser()
  const wordmarkRef = useRef(null)

  useLayoutEffect(() => {
    if (phase === 'done') return
    document.documentElement.classList.add(ACTIVE_CLASS)
    return () => document.documentElement.classList.remove(ACTIVE_CLASS)
  }, [phase])

  // 보통은 animationend로 닫히지만, 백그라운드 탭·CSS 로드 실패처럼 이벤트가 안 오면 화면을 막지 않게 강제로 닫는다.
  useEffect(() => {
    if (phase === 'done') return
    const timer = setTimeout(() => setPhase('done'), 1600)
    return () => clearTimeout(timer)
  }, [phase])

  // 새로고침 직후에는 로그인 상태를 확인하는 중이라 아래 화면(로그인 또는 홈)이 아직 정해지지 않았다.
  // 그 사이에 목표 로고를 찾으면 없는 줄 알고 그냥 사라지므로, 확인이 끝날 때까지 가운데에서 기다린다.
  useEffect(() => {
    if (!introEnded || status === 'loading') return
    dockOrFade()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introEnded, status])

  function dockOrFade() {
    const target = document.querySelector('[data-splash-target]')
    const from = wordmarkRef.current?.getBoundingClientRect()
    const to = target?.getBoundingClientRect()
    if (!from || !to || to.width === 0) {
      setPhase('out')
      return
    }
    wordmarkRef.current.style.setProperty('--dock-x', `${to.left - from.left}px`)
    wordmarkRef.current.style.setProperty('--dock-y', `${to.top - from.top}px`)
    setPhase('dock')
  }

  function handleAnimationEnd(e) {
    if (e.animationName === 'splash-crown-drop') setIntroEnded(true)
    else if (e.target === e.currentTarget) setPhase('done')
  }

  if (phase === 'done') return null

  return (
    <div
      aria-hidden="true"
      className={`splash fixed inset-0 z-[100] flex items-center justify-center bg-background is-${phase}${
        status === 'authenticated' ? ' is-over' : ''
      }`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div ref={wordmarkRef} className="splash-wordmark">
        {/* 로고를 왕관과 몸통 두 장(같은 캔버스 크기)으로 나눠 겹쳐 둔다. 왕관이 위에서 떨어져 씌워진다.
            크기는 Login의 data-splash-target 로고와 같아야 dock 이동이 어긋나지 않는다. */}
        <div className="splash-stack relative w-[232px]">
          <img src="/cking-logo-body.png" alt="" className="splash-body block w-full" />
          <img src="/cking-crown.png" alt="" className="splash-crown absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  )
}
