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
