import { formatDateTime } from '@cking/shared/format'
export { formatDateTime, formatNumber, totalPrizeQuantity } from '@cking/shared/format'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2025.04.18 (금) 19:00" 형태 - 이벤트 상세 헤더용. */
export function formatEventDate(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} (${WEEKDAYS[date.getDay()]}) ${hh}:${mi}`
}

/** 상대 시각("18분 전", "2시간 전", "어제"). */
export function formatRelativeTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return formatDateTime(iso)
}

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
