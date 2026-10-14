// 제재(댓글 작성 제한·스페이스 차단) 안내문 가공. 계약은 Cking-BE docs/domains/sanction/api.md, notification/api.md.
//
// BE는 해제 시각을 구조화된 필드로 주지 않고 메시지·알림 본문 문장에 UTC로 넣는다(오류 응답 data는 null, ApiError는 code·message·status뿐).
// 계약은 "메시지에 해제 시각(UTC)이 들어간다"까지이고, 아래 두 정규식이 읽는 형식은 BE 구현(SanctionQueryService의
// "해제 시각(UTC): <Instant>", SanctionNotificationService의 "yyyy-MM-dd HH:mm 'UTC'") 기준이다.
// 형식이 바뀌면 시각만 조용히 빠지고 사유 문구는 그대로 보이도록 폴백을 뒀다. 구조화된 필드가 생기면 그걸 쓰도록 바꾼다.
import { formatDateTime } from './format.js'

// 오류 메시지: "... 해제 시각(UTC): 2026-10-20T03:00:00Z" (java.time.Instant 문자열, 초 이하가 붙을 수 있다).
const ERROR_END_PATTERN = /해제 시각\(UTC\):\s*(\S+)/
// 알림 본문: "... 2026-10-14 00:00 UTC까지 ..." (BE가 분 단위로 올려 적는다).
const BODY_END_PATTERN = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) UTC/g

const RESTRICTION_MESSAGES = {
  COMMENT_RESTRICTED: '댓글 작성이 제한되어 있어요.',
  SPACE_COMMENT_BLOCKED: '이 스페이스에서는 댓글을 쓸 수 없어요. 다른 스페이스에서는 쓸 수 있어요.',
}

export function isCommentRestrictionCode(code) {
  return Object.hasOwn(RESTRICTION_MESSAGES, code)
}

/** 초 이하가 있으면 다음 분으로 올린다. 표시한 시각 이후에는 항상 제한이 풀려 있게 하려는 것이다. */
export function ceilToMinute(date) {
  return new Date(Math.ceil(date.getTime() / 60000) * 60000)
}

/** 오류 메시지에서 해제 시각을 꺼낸다. 형식이 다르면 null. */
export function parseRestrictionEnd(message) {
  const match = ERROR_END_PATTERN.exec(message ?? '')
  if (!match) return null
  const date = new Date(match[1])
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * 댓글 작성·수정이 제한 오류(COMMENT_RESTRICTED·SPACE_COMMENT_BLOCKED)로 막혔을 때 보여줄 문구.
 * 해제 시각을 읽을 수 있으면 앱 공통 시각 표기(브라우저 시간대)로 붙이고, 못 읽으면 시각 없이 사유만 안내한다.
 * 제한 오류가 아니면 null.
 */
export function describeCommentRestriction(code, message) {
  if (!isCommentRestrictionCode(code)) return null
  const base = RESTRICTION_MESSAGES[code]
  const end = parseRestrictionEnd(message)
  return end ? `${base} ${formatDateTime(ceilToMinute(end))}부터 다시 쓸 수 있어요.` : base
}

/** 알림 본문의 "YYYY-MM-DD HH:mm UTC"를 앱 공통 시각 표기(브라우저 시간대)로 바꾼다. 해당 형식이 없으면 그대로 돌려준다. */
export function localizeNoticeBody(body) {
  if (!body) return body
  return body.replace(BODY_END_PATTERN, (_, year, month, day, hour, minute) =>
    formatDateTime(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))),
  )
}
