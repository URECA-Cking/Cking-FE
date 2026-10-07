import { useEffect, useState } from 'react'

const LETTERS = ['C', 'K', 'i', 'n', 'g']

/**
 * 페이지를 새로 열 때마다(새로고침 포함) 스플래시를 먼저 보여준다.
 * OAuth 콜백은 로그인 도중 거쳐 가는 화면이라 진입으로 보지 않고, 모션 줄이기 설정 사용자는 건너뛴다.
 */
function shouldShowSplash() {
  if (window.location.pathname.startsWith('/oauth/callback')) return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * 임시 첫 화면: CKing 워드마크가 글자별로 떠오른 뒤 흩어지며 사라진다(약 0.9초, index.css의 splash-* keyframes).
 * 화면 위에 덮어씌우는 방식이라 아래에서는 라우트(비로그인이면 로그인 화면)가 이미 렌더링돼 있다.
 */
export default function Splash() {
  const [visible, setVisible] = useState(shouldShowSplash)

  // 보통은 animationend로 닫히지만, 백그라운드 탭·CSS 로드 실패처럼 이벤트가 안 오면 화면을 막지 않게 강제로 닫는다.
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="splash fixed inset-0 z-[100] flex items-center justify-center bg-background"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setVisible(false)
      }}
    >
      <div className="splash-wordmark flex flex-col items-center">
        <span className="flex text-[44px] font-extrabold leading-none tracking-[-0.04em] text-on-surface [perspective:400px]">
          {LETTERS.map((letter, i) => (
            <span key={letter} className="splash-letter inline-block" style={{ animationDelay: `${i * 45}ms` }}>
              {letter}
            </span>
          ))}
        </span>
        <span className="splash-bar mt-3 h-[3px] w-full rounded-full bg-primary" />
      </div>
    </div>
  )
}
