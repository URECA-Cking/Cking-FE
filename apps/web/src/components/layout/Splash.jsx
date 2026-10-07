import { useEffect, useState } from 'react'

const SEEN_KEY = 'cking:splash-seen'
const LETTERS = ['C', 'K', 'i', 'n', 'g']

/**
 * 같은 브라우저 세션에서 처음 들어왔을 때만 스플래시를 보여준다.
 * OAuth 콜백 복귀·새로고침도 전체 페이지 로드라 세션 단위로 막지 않으면 매번 반복된다.
 * 모션 줄이기 설정 사용자는 건너뛴다.
 */
function shouldShowSplash() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return !sessionStorage.getItem(SEEN_KEY)
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 매번 보여도 동작에는 문제없다.
    return true
  }
}

/**
 * 임시 첫 화면: CKing 워드마크가 글자별로 떠오른 뒤 흩어지며 사라진다(약 0.9초, index.css의 splash-* keyframes).
 * 화면 위에 덮어씌우는 방식이라 아래에서는 라우트(비로그인이면 로그인 화면)가 이미 렌더링돼 있다.
 */
export default function Splash() {
  const [visible, setVisible] = useState(shouldShowSplash)

  // 표시 기록은 렌더 밖에서 남긴다. StrictMode가 초기화 함수를 두 번 부르면 두 번째에 false가 되기 때문이다.
  useEffect(() => {
    if (!visible) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // 위와 같은 이유로 무시한다.
    }
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
