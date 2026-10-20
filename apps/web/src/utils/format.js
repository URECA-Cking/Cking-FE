import { formatDateTime } from '@cking/shared/format'
export { formatDateTime, formatNumber, totalPrizeQuantity } from '@cking/shared/format'

// 기존 호출부도 공통 날짜·시간 표기를 사용한다.
export const formatEventDate = formatDateTime
export const formatShortDate = formatDateTime
export const formatRelativeTime = formatDateTime

/** 종료까지 남은 일수를 "D-3" / "D-DAY" / "종료"로 표현한다. */
export function formatDday(endAt, { closed = false } = {}) {
  if (closed) return '종료'
  if (!endAt) return ''
  const end = new Date(endAt)
  if (Number.isNaN(end.getTime())) return ''
  const diff = end.getTime() - Date.now()
  if (diff <= 0) return '종료'
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'D-DAY'
  return `D-${days}`
}
