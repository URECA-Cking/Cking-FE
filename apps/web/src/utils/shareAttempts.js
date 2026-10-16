const KEY_PREFIX = 'cking.shareRewardAttempts.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 브라우저 저장소를 돌려준다. 비공개 창·차단 설정으로 접근 자체가 막히면 null이다. */
function defaultStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** 회원별 저장 키를 만든다. 같은 브라우저에서 계정이 바뀌어도 미확정 요청이 섞이지 않게 회원 번호를 붙인다. */
export function shareAttemptsKey(memberId) {
  return `${KEY_PREFIX}${memberId}`
}

/** 이 회원의 크리에이터별 미확정 요청 전체를 읽는다. 저장소를 못 쓰거나 값이 깨졌으면 빈 객체다. */
function readAll(memberId, storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(shareAttemptsKey(memberId)) ?? 'null')
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 이 회원의 미확정 요청 전체를 저장한다. 비어 있으면 키를 지운다. 저장에 실패해도 오류를 밖으로 던지지 않는다. */
function writeAll(memberId, all, storage) {
  try {
    if (Object.keys(all).length === 0) storage?.removeItem(shareAttemptsKey(memberId))
    else storage?.setItem(shareAttemptsKey(memberId), JSON.stringify(all))
  } catch {
    // 저장에 실패하면 새로고침 뒤에는 같은 requestId로 복구할 수 없다.
  }
}

/**
 * 승인 여부가 불확실해 보존한 공유 보상 요청({ requestId })을 읽는다. 없거나 UUID가 아니면 null이다.
 * 크리에이터마다 따로 보관해 다른 크리에이터의 요청이 덮어쓰지 않는다.
 */
export function readShareAttempt(memberId, creatorId, storage = defaultStorage()) {
  if (memberId == null || creatorId == null) return null
  const stored = readAll(memberId, storage)[creatorId]
  return stored != null && typeof stored.requestId === 'string' && UUID_PATTERN.test(stored.requestId)
    ? { requestId: stored.requestId }
    : null
}

/** 요청을 보내기 전에 requestId를 보존한다. 응답 전에 화면이 닫혀도 같은 requestId로 이어 갈 수 있다. */
export function writeShareAttempt(memberId, creatorId, attempt, storage = defaultStorage()) {
  if (memberId == null || creatorId == null) return
  const all = readAll(memberId, storage)
  all[creatorId] = { requestId: attempt.requestId }
  writeAll(memberId, all, storage)
}

/** 적립이 승인됐거나 서버가 처리하지 않았다고 확정한 요청을 지운다. */
export function removeShareAttempt(memberId, creatorId, storage = defaultStorage()) {
  if (memberId == null || creatorId == null) return
  const all = readAll(memberId, storage)
  if (!(creatorId in all)) return
  delete all[creatorId]
  writeAll(memberId, all, storage)
}
