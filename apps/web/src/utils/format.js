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

/** 마감까지 남은 시간을 "3일 19:32:37" / "19:32:37"로 표현한다. 이미 지났거나 값이 없으면 null. */
export function formatCountdown(endAt, now) {
  const end = new Date(endAt).getTime()
  if (!Number.isFinite(end) || end <= now) return null
  const sec = Math.floor((end - now) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const days = Math.floor(sec / 86400)
  const hms = `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`
  return days > 0 ? `${days}일 ${hms}` : hms
}
