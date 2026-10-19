/** 브라우저 시간대 기준 yy.mm.dd. HH시 mm분 (24시간제). */
export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getFullYear() % 100)}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}. ${pad(date.getHours())}시 ${pad(date.getMinutes())}분`
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
