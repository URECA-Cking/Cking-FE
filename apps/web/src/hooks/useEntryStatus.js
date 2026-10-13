import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntryStatus } from '../api/entries.js'
import { createEntryStatusController } from '../utils/entryStatusController.js'

const INITIAL = { eventId: null, status: null, failed: false }

/**
 * 이벤트 응모 현황(GET /api/events/{id}/entry-status)을 조회한다. 표시용 값이다.
 * 조회·갱신·응모 직후 대기 규칙은 entryStatusController에 있고(단위 테스트됨), 여기서는 React 상태에 연결만 한다.
 * @returns {{ status: object|null, failed: boolean, retry: () => void,
 *   beginEntry: (requestId: string, count: number) => void, acceptEntry: (requestId: string) => void }}
 *   status가 null이면 값이 없거나 믿을 수 없는 상태. failed일 때 retry로 사용자가 다시 확인할 수 있다.
 *   beginEntry는 응모 요청을 보내기 직전에, acceptEntry는 응모가 수락됐을 때(SUCCESS·DUPLICATE_REPLAY) 부른다.
 */
export function useEntryStatus(eventId, { enabled, live }) {
  const [view, setView] = useState(INITIAL)
  const controller = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined
    const created = createEntryStatusController({
      fetchStatus: () => getEntryStatus(eventId),
      onChange: (next) => setView({ eventId, ...next }),
      isVisible: () => document.visibilityState === 'visible',
    })
    controller.current = created
    const onVisible = () => created.onVisible()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      created.dispose()
      controller.current = null
    }
  }, [eventId, enabled])

  useEffect(() => {
    controller.current?.sync({ live })
  }, [eventId, enabled, live])

  const retry = useCallback(() => controller.current?.retry(), [])
  const beginEntry = useCallback((requestId, count) => controller.current?.beginEntry(requestId, count), [])
  const acceptEntry = useCallback((requestId) => controller.current?.acceptEntry(requestId), [])

  // 다른 이벤트에서 받은 값은 이 이벤트의 것이 아니므로 쓰지 않는다.
  const mine = view.eventId === eventId ? view : INITIAL
  return { status: mine.status, failed: mine.failed, retry, beginEntry, acceptEntry }
}
