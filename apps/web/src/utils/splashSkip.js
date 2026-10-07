const KEY = 'cking:skip-splash'

/** 당겨서 새로고침으로 다시 열리는 페이지는 이미 CKing 연출을 봤으므로, 다음 한 번은 스플래시를 건너뛴다. */
export function markSkipSplash() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // 저장소를 못 써도 스플래시가 한 번 더 보일 뿐이라 무시한다.
  }
}

/** 표식을 읽고 지운다. 한 번만 호출해 결과를 쥐고 있어야 한다(StrictMode가 초기화 함수를 두 번 부른다). */
export function consumeSkipSplash() {
  try {
    const skip = sessionStorage.getItem(KEY) === '1'
    sessionStorage.removeItem(KEY)
    return skip
  } catch {
    return false
  }
}
