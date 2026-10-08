const DAY_MS = 24 * 60 * 60 * 1000

const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10)

/**
 * 출석 스탬프 카드의 칸. 최근 며칠 동안 출석한 날의 수만큼 왼쪽 칸부터 채운다(날짜 칸이 아니라 쌓이는 도장).
 * 출석의 하루는 BE가 UTC 날짜로 센다(한국 시간으로는 오전 9시에 초기화). 그래서 같은 UTC 날짜의 적립은 하루로 세고,
 * 최근 며칠도 UTC 날짜로 자른다. 방금 완료한 오늘은 원장 반영보다 빨라 completedToday로도 센다.
 * 오늘 아직 안 찍었다면 다음에 찍을 첫 빈 칸을 next로 알린다. 화면 표시용 계산이라 날짜 경계의 최종 판정은 서버가 한다.
 */
export function buildStampSlots({ ledgerItems = [], missionId, completedToday = false, now = Date.now(), slots = 7 }) {
  const today = utcDate(now)
  const windowStart = utcDate(now - (slots - 1) * DAY_MS)
  const stampedDays = new Set(
    ledgerItems
      .filter((item) => item.type === 'EARN' && item.missionId === missionId)
      .map((item) => new Date(item.createdAt).getTime())
      .filter(Number.isFinite)
      .map(utcDate)
      .filter((date) => date >= windowStart && date <= today),
  )
  if (completedToday) stampedDays.add(today)

  const count = Math.min(stampedDays.size, slots)
  return Array.from({ length: slots }, (_, index) => ({
    stamped: index < count,
    next: !completedToday && index === count,
  }))
}
