/** 하단 메뉴 이동 시 공용 스크롤 컨테이너를 최상단으로 옮기고 앱 크롬 초기화를 요청한다. */
export function resetNavigationScroll(scrollContainer, resetChrome) {
  if (scrollContainer) scrollContainer.scrollTop = 0
  resetChrome()
}
