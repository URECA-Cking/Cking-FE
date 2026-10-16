import { formatDateTime } from '@cking/shared/format'
export { formatDateTime, formatNumber, totalPrizeQuantity } from '@cking/shared/format'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "오후 07:00" 형태의 12시간제 시각. */
function formatTime12(date) {
  const hour = date.getHours()
  const hh = String(hour % 12 || 12).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${hour < 12 ? '오전' : '오후'} ${hh}:${mi}`
}

/** "2025.04.18 (금) 오후 07:00" 형태 - 이벤트 상세 헤더용. 시각은 공용 formatDateTime처럼 12시간제(오전/오후)로 맞춘다. */
export function formatEventDate(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} (${WEEKDAYS[date.getDay()]}) ${formatTime12(date)}`
}

/** "26.10.21 (수)" 형태 - 목록 카드처럼 좁은 곳에서 쓴다. withTime이면 "26.10.21 (수) 오후 03:05"처럼 12시간제 시각을 붙인다. */
export function formatShortDate(iso, { withTime = false } = {}) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const day = `${yy}.${mm}.${dd} (${WEEKDAYS[date.getDay()]})`
  return withTime ? `${day} ${formatTime12(date)}` : day
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
