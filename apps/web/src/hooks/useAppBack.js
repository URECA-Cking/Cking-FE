import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 이 앱 안에서 되돌아갈 기록이 있는지. react-router가 이 앱에서 쌓은 위치를 `history.state.idx`에 기록한다.
 * 로그인 직후나 주소로 직접 연 경우는 이전 기록이 앱 밖(로그인 중간 페이지 등)이라 idx가 0이고, 그쪽으로 돌아가면 안 된다.
 */
export function canGoBackInApp() {
  return (window.history.state?.idx ?? 0) > 0
}

/**
 * 뒤로 가기 동작. 앱 안에 되돌아갈 기록이 있으면 한 단계 뒤로, 없으면 fallback 주소로 간다(기록을 늘리지 않고 교체).
 * @param {string} [fallback]
 */
export function useAppBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    if (canGoBackInApp()) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
