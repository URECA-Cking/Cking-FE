const KEY_PREFIX = 'cking.welcomeGuideHidden.'

/** 브라우저 저장소를 돌려준다. 비공개 창·차단 설정으로 접근 자체가 막히면 null이다. */
function defaultStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** 회원별 저장 키를 만든다. 같은 브라우저에서 계정이 바뀌어도 숨김 상태가 섞이지 않게 회원 번호를 붙인다. */
export function guideHiddenKey(memberId) {
  return `${KEY_PREFIX}${memberId}`
}

/** 이 회원이 시작 가이드를 닫아 두었는지 읽는다. 저장소를 못 쓰거나 값이 없으면 false(보이는 상태)다. */
export function readGuideHidden(memberId, storage = defaultStorage()) {
  if (memberId == null) return false
  try {
    return storage?.getItem(guideHiddenKey(memberId)) === '1'
  } catch {
    return false
  }
}

/** 시작 가이드 숨김 여부를 저장한다. 저장에 실패해도 이번 화면에서는 상태가 바뀌므로 오류를 밖으로 던지지 않는다. */
export function writeGuideHidden(memberId, hidden, storage = defaultStorage()) {
  if (memberId == null) return
  try {
    if (hidden) storage?.setItem(guideHiddenKey(memberId), '1')
    else storage?.removeItem(guideHiddenKey(memberId))
  } catch {
    // 저장에 실패해도 현재 화면의 숨김 상태는 유지된다.
  }
}
