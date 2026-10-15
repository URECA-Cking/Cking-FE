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
