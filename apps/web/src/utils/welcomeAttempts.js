import { WELCOME_QUEST_STEPS } from './welcomeQuest.js'

const KEY_PREFIX = 'cking.welcomeClaimAttempts.'
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
export function attemptsKey(memberId) {
  return `${KEY_PREFIX}${memberId}`
}

/** 저장된 지급 시도가 쓸 수 있는 모양(UUID requestId, 불리언 또는 없는 answer)인지 확인한다. */
function isValidAttempt(value) {
  return value != null
    && typeof value.requestId === 'string'
    && UUID_PATTERN.test(value.requestId)
    && (value.answer === undefined || typeof value.answer === 'boolean')
}

/** 이 회원의 저장된 지급 시도 전체를 읽는다. 저장소를 못 쓰거나 값이 깨졌으면 빈 객체다. */
function readAll(memberId, storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(attemptsKey(memberId)) ?? 'null')
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 이 회원의 지급 시도 전체를 저장한다. 비어 있으면 키를 지운다. 저장에 실패해도 오류를 밖으로 던지지 않는다. */
function writeAll(memberId, all, storage) {
  try {
    if (Object.keys(all).length === 0) storage?.removeItem(attemptsKey(memberId))
    else storage?.setItem(attemptsKey(memberId), JSON.stringify(all))
  } catch {
    // 저장에 실패하면 이번 화면의 메모리 보관만 남는다.
  }
}

/**
 * 승인 여부가 불확실해 보존한 지급 시도({ requestId, answer })를 읽는다. 없거나 쓸 수 없는 값이면 null이다.
 * 새로고침 뒤에도 같은 requestId·본문으로 복구하려는 용도라, 모양이 틀린 값은 버리고 새 시도를 만들게 한다.
 */
export function readAttempt(memberId, step, storage = defaultStorage()) {
  if (memberId == null || !Object.values(WELCOME_QUEST_STEPS).includes(step)) return null
  const stored = readAll(memberId, storage)[step]
  return isValidAttempt(stored) ? { requestId: stored.requestId, answer: stored.answer } : null
}

/** 지급 시도를 보존한다. 요청을 보내기 전에 저장해 두면, 응답 전에 화면이 닫혀도 같은 requestId로 이어 갈 수 있다. */
export function writeAttempt(memberId, step, attempt, storage = defaultStorage()) {
  if (memberId == null) return
  const all = readAll(memberId, storage)
  all[step] = attempt.answer === undefined ? { requestId: attempt.requestId } : { requestId: attempt.requestId, answer: attempt.answer }
  writeAll(memberId, all, storage)
}

/** 지급이 승인됐거나 서버가 처리하지 않았다고 확정한 시도를 지운다. */
export function removeAttempt(memberId, step, storage = defaultStorage()) {
  if (memberId == null) return
  const all = readAll(memberId, storage)
  if (!(step in all)) return
  delete all[step]
  writeAll(memberId, all, storage)
}
