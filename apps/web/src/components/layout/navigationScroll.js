const scrollPositions = new Map()
export const MAX_SCROLL_POSITION_ENTRIES = 100
export const MAX_SCROLL_RESTORE_ATTEMPTS = 120
export const SCROLL_RESTORE_TOLERANCE_PX = 1

/** 현재 탭의 일반 클릭일 때만 네비게이션 스크롤 초기화를 허용한다. */
export function shouldResetNavigationOnClick(event) {
  if (!event) return false
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

/** 활성 메뉴를 일반 클릭한 경우에만 현재 history 위치를 최상단으로 초기화한다. */
export function shouldResetSelectedNavigation(event, isSelected) {
  return Boolean(isSelected) && shouldResetNavigationOnClick(event)
}

/** history 위치별 공용 스크롤 위치를 SPA 세션 동안 기록한다. */
export function saveNavigationScroll(locationKey, scrollTop) {
  if (!locationKey) return
  scrollPositions.delete(locationKey)
  scrollPositions.set(locationKey, Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0))
  while (scrollPositions.size > MAX_SCROLL_POSITION_ENTRIES) {
    scrollPositions.delete(scrollPositions.keys().next().value)
  }
}

/** 새 진입은 최상단을, 뒤로 가기는 해당 history 위치의 기록을 반환한다. */
export function resolveNavigationScrollTop(navigationType, locationKey) {
  if (navigationType !== 'POP') return 0
  return scrollPositions.get(locationKey) ?? 0
}

/** 전환 정책에 맞는 스크롤 위치를 적용하고 앱 크롬을 기본 표시 상태로 되돌린다. */
export function restoreNavigationScroll(scrollContainer, navigationType, locationKey, resetChrome) {
  const scrollTop = resolveNavigationScrollTop(navigationType, locationKey)
  if (scrollContainer) scrollContainer.scrollTop = scrollTop
  resetChrome?.(scrollTop)
  return scrollTop
}

/** 복원 목표에 아직 닿지 않았고 제한 횟수가 남았을 때만 다음 프레임 복원을 계속한다. */
export function shouldContinueNavigationScrollRestore(targetScrollTop, currentScrollTop, attempt) {
  return targetScrollTop - currentScrollTop > SCROLL_RESTORE_TOLERANCE_PX && attempt < MAX_SCROLL_RESTORE_ATTEMPTS
}

/** 활성 하단 메뉴를 다시 누를 때 현재 history 위치도 최상단으로 초기화한다. */
export function resetNavigationScroll(scrollContainer, locationKey, resetChrome) {
  if (scrollContainer) scrollContainer.scrollTop = 0
  saveNavigationScroll(locationKey, 0)
  resetChrome?.(0)
}
