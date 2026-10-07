/** ISO 시각을 한국어 날짜와 시각으로 표시한다. */
export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('ko-KR') : '0'
}

export function totalPrizeQuantity(prizes) {
  return Array.isArray(prizes)
    ? prizes.reduce((sum, prize) => sum + (Number(prize?.quantity) || 0), 0)
    : 0
}
