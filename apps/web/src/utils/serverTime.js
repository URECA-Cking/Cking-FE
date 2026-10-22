// 서버가 내려주는 시각 문자열(ISO 8601)을 Date로 읽는다.
// Cking-BE의 시각은 UTC다. `Z`나 `+09:00` 같은 오프셋이 붙어 있으면 그대로 읽고, 오프셋이 없으면(LocalDateTime 형태)
// 브라우저는 현지 시간으로 해석해 최대 9시간 어긋나므로 UTC로 읽는다.
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

/** 읽을 수 없는 값이면 null이다. */
export function parseServerTime(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value).trim()
  const date = new Date(HAS_OFFSET.test(text) ? text : `${text}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}
