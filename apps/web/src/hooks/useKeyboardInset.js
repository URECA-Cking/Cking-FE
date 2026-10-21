import { useEffect, useState } from 'react'

// 브라우저 주소창이 접히거나 펴질 때의 작은 변화는 키보드로 보지 않는다.
const MIN_KEYBOARD_PX = 100

/**
 * 화면 키보드가 가리는 아래쪽 높이(px). 키보드가 없으면 0이다.
 * 안드로이드 크롬은 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않고 보이는 영역(visualViewport)만 줄이는 경우가 있어
 * 화면 맨 아래에 있는 입력창이 키보드 뒤에 남는다. 이 값만큼 전체 화면 오버레이의 아래쪽을 띄워, 키보드 위쪽 영역 안에서 스크롤되게 한다.
 * 레이아웃 뷰포트가 같이 줄어드는 환경(innerHeight도 함께 줄어듦)에서는 0이라 영향이 없다.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    function update() {
      const covered = Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
      setInset(covered >= MIN_KEYBOARD_PX ? covered : 0)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
