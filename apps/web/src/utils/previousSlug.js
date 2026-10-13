// 스페이스 공유 주소(slug)의 이전 주소 기억. BE는 버린 slug를 14일 동안 본인 전용으로 예약해 두고 14일 변경 간격 없이
// 되돌릴 수 있게 하지만(docs/domains/creator/space-slug-policy.md), 이전 주소를 응답으로 알려 주지는 않는다.
// 그래서 이 브라우저에서 바꿀 때 이전 주소를 기억해 두었다가 되돌리기에 쓴다. BE가 `restorableSlug`를 내려주면 서버 값으로 대체한다.

const KEY_PREFIX = 'cking:space:previous-slug:'
/** BE의 이전 slug 예약 기간. 지나면 다른 Creator가 쓸 수 있어 되돌릴 수 있다고 안내하지 않는다. */
export const PREVIOUS_SLUG_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * 기억해 둔 이전 slug 중 지금 되돌리기로 보여줄 값. 현재 주소와 다르고 예약 기간(14일) 안일 때만 돌려준다.
 *
 * @param {{ slug: string, at: number } | null} record
 * @param {string} currentSlug
 * @param {number} now
 */
export function selectRestorableSlug(record, currentSlug, now = Date.now()) {
  if (!record || typeof record.slug !== 'string' || typeof record.at !== 'number') return null
  if (!record.slug || record.slug === currentSlug) return null
  if (now - record.at >= PREVIOUS_SLUG_TTL_MS || now < record.at) return null
  return record.slug
}

// 아래는 브라우저 저장소를 다루는 얇은 래퍼다. 저장소가 막혀 있으면(시크릿 모드 등) 조용히 기억하지 않는다.

export function readPreviousSlug(creatorId, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY_PREFIX + creatorId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function rememberPreviousSlug(creatorId, slug, now = Date.now(), storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY_PREFIX + creatorId, JSON.stringify({ slug, at: now }))
  } catch {
    // 기억하지 못해도 되돌리기 버튼만 안 보일 뿐 주소 변경에는 영향이 없다.
  }
}

export function forgetPreviousSlug(creatorId, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY_PREFIX + creatorId)
  } catch {
    // 위와 같다.
  }
}
