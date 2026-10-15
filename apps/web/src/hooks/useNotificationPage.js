import { useMemo, useState } from 'react'
import { useAsync } from './useAsync.js'

/** 조회 응답보다 늦게 확정된 읽음 상태가 오래된 응답에 덮이지 않도록 보관한다. */
export function useNotificationPage(loader, deps, options) {
  const { data: serverData, ...request } = useAsync(loader, deps, options)
  const [readOverrides, setReadOverrides] = useState({})
  const data = useMemo(() => serverData && ({
    ...serverData,
    items: serverData.items.map((item) => {
      const readAt = readOverrides[item.notificationId]
      return readAt ? { ...item, readAt } : item
    }),
  }), [serverData, readOverrides])

  /** 개별 읽음의 낙관적 값과 서버 확정값을 같은 알림에 적용한다. 실패하면 덮어쓰기를 제거한다. */
  const markRead = (notificationId, readAt) => {
    setReadOverrides((current) => {
      const next = { ...current }
      if (readAt) next[notificationId] = readAt
      else delete next[notificationId]
      return next
    })
  }

  /** 현재 조회된 알림만 전체 읽음에 반영하며, 나중에 도착한 오래된 GET에도 값을 유지한다. */
  const markAllRead = (readAt) => {
    setReadOverrides((current) => {
      const next = { ...current }
      for (const item of data?.items ?? []) {
        if (!item.readAt) next[item.notificationId] = readAt
      }
      return next
    })
  }

  /** 실패한 전체 읽음 요청에서 추가한 값만 제거한다. */
  const rollbackAllRead = (readAt) => {
    setReadOverrides((current) => {
      const next = { ...current }
      for (const [id, value] of Object.entries(next)) {
        if (value === readAt) delete next[id]
      }
      return next
    })
  }

  return { ...request, data, markRead, markAllRead, rollbackAllRead }
}
