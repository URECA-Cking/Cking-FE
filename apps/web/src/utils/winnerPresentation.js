const STATUS_META = {
  SELECTED: { label: '수령 대기', tone: 'bg-berry-tint text-primary', icon: 'workspace_premium' },
  RECEIVED: { label: '수령 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
  DECLINED: { label: '당첨 포기', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'block' },
  DISQUALIFIED: { label: '자격 박탈', tone: 'bg-error-container text-on-error-container', icon: 'gpp_bad' },
}

export const WINNER_STATUS_ORDER = ['SELECTED', 'RECEIVED', 'DECLINED', 'DISQUALIFIED']

export function winnerStatusMeta(status) {
  return STATUS_META[status] ?? {
    label: status ?? '상태 확인 필요',
    tone: 'bg-surface-container-high text-on-surface-variant',
    icon: 'help',
  }
}

export function winnerStatusFilters(winners) {
  const counts = Object.fromEntries(WINNER_STATUS_ORDER.map((status) => [status, 0]))
  for (const winner of winners) {
    if (winner?.winnerManagementStatus in counts) {
      counts[winner.winnerManagementStatus] += 1
    }
  }

  return [
    { value: 'ALL', label: '전체', count: winners.length },
    ...WINNER_STATUS_ORDER.map((status) => ({
      value: status,
      label: winnerStatusMeta(status).label,
      count: counts[status],
    })),
  ]
}

export function filterWinnersByStatus(winners, status) {
  if (status === 'ALL') return winners
  return winners.filter((winner) => winner.winnerManagementStatus === status)
}

export function winnerRankLabel(rank) {
  return Number.isInteger(rank) && rank > 0 ? `${rank}등 당첨` : '당첨'
}

export function winnerEventTitle(winner, eventById) {
  return eventById.get(winner.eventId)?.title?.trim() || `이벤트 #${winner.eventId}`
}

// 포기·자격 박탈된 당첨은 더 이상 당첨이 아니다. 상태를 알 수 없으면(상태 필드가 없는 응답) 당첨으로 본다.
const INACTIVE_WINNER_STATUSES = new Set(['DECLINED', 'DISQUALIFIED'])

/** 지금도 유효한 당첨인지. 당첨 포기·자격 박탈이면 false다. */
export function isActiveWin(winner) {
  return Boolean(winner) && !INACTIVE_WINNER_STATUSES.has(winner.winnerManagementStatus)
}

/** 이벤트별로 내 당첨 하나를 고른다. 같은 이벤트에 여러 건이면 유효한 당첨을 먼저 쓰고, 그다음은 나중 회차를 쓴다. */
export function pickWinnerPerEvent(winners) {
  const byEvent = new Map()
  for (const winner of winners ?? []) {
    const current = byEvent.get(winner.eventId)
    if (!current || isActiveWin(winner) || !isActiveWin(current)) byEvent.set(winner.eventId, winner)
  }
  return byEvent
}

const REDRAW_CAPTION = '결원이 생겨 다시 추첨했어요.'

function drawTitle(group, redrawCount) {
  if (group.drawType === 'INITIAL') return '최초 추첨'
  if (group.drawType === 'REDRAW') return redrawCount > 1 ? `${group.drawNo}차 재추첨` : '재추첨'
  return `${group.drawNo}차 추첨`
}

/**
 * 공개 당첨자 목록을 추첨 회차(drawNo)별로 나눈다. 회차는 번호가 작은 것부터, 회차 안은 순위 순이다.
 * 회차가 둘 이상일 때만 제목을 붙이고(최초 추첨 / 재추첨), 하나뿐이면 제목 없이 한 묶음으로 둔다.
 */
export function groupWinnersByDraw(winners) {
  const byDraw = new Map()
  for (const winner of winners ?? []) {
    const drawNo = Number.isInteger(winner.drawNo) ? winner.drawNo : 0
    const group = byDraw.get(drawNo) ?? { drawNo, drawType: winner.drawType, winners: [] }
    group.winners.push(winner)
    byDraw.set(drawNo, group)
  }
  const groups = [...byDraw.values()].sort((a, b) => a.drawNo - b.drawNo)
  const redrawCount = groups.filter((group) => group.drawType === 'REDRAW').length
  return groups.map((group) => ({
    ...group,
    winners: [...group.winners].sort((a, b) => (a.rankInDrawing ?? 0) - (b.rankInDrawing ?? 0)),
    title: groups.length > 1 ? drawTitle(group, redrawCount) : null,
    caption: groups.length > 1 && group.drawType === 'REDRAW' ? REDRAW_CAPTION : null,
  }))
}
