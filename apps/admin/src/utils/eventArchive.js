/** 관리자 Event 목록이 사용하는 서버 보관 상태 Query 값이다. */
export const EVENT_ARCHIVE_VIEWS = [
  { value: 'ACTIVE', label: '운영 목록' },
  { value: 'ARCHIVED', label: '보관함' },
]

/** Event 상태와 보관 메타데이터가 API 계약상 보관·복원을 허용하는지 판정한다. */
export function canArchiveEvent(event) {
  return event?.status === 'PUBLISHED' && !event.archivedAt
}

export function canUnarchiveEvent(event) {
  return event?.status === 'PUBLISHED' && Boolean(event.archivedAt)
}

/** 목록에서 상세로 이동할 때 현재 보관함 문맥을 유지한다. */
export function archiveStatusSearch(archiveStatus) {
  return archiveStatus === 'ARCHIVED' ? '?archiveStatus=ARCHIVED' : ''
}

/** 목록·상세 이동에서 보관함과 상태 필터 문맥을 함께 유지한다. */
export function eventListSearch(archiveStatus, status) {
  const params = new URLSearchParams()
  if (archiveStatus === 'ARCHIVED') {
    params.set('archiveStatus', 'ARCHIVED')
  } else if (status) {
    params.set('status', status)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** 보관함은 PUBLISHED Event만 서버에서 받으므로 별도 상태 필터를 노출하지 않는다. */
export function shouldShowEventStatusFilter(archiveStatus) {
  return archiveStatus !== 'ARCHIVED'
}
