import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError } from '../api/client.js'
import {
  getAllCreatorApplications,
  getAllPendingEvents,
  getAllRequestedRedraws,
  getAllUnresolvedDeadStreams,
  getDrawingEvents,
} from '../api/admin.js'

const LOADERS = {
  creatorApplications: getAllCreatorApplications,
  pendingEvents: getAllPendingEvents,
  requestedRedraws: getAllRequestedRedraws,
  unresolvedDeadStreams: getAllUnresolvedDeadStreams,
  operatingEvents: getDrawingEvents,
}

function initialSections() {
  return Object.fromEntries(Object.keys(LOADERS).map((key) => [key, { loading: true, data: null, error: null }]))
}

/** Dashboard의 독립 조회를 병렬 실행하고, 각 영역의 성공·실패 상태를 분리한다. */
export function useDashboardData() {
  const [sections, setSections] = useState(initialSections)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const requestSequence = useRef(0)

  const reload = useCallback(async ({ initial = false } = {}) => {
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    if (!initial) setSections((current) => Object.fromEntries(Object.entries(current).map(([key, section]) => [key, { ...section, loading: true, error: null }])))

    const entries = Object.entries(LOADERS)
    const results = await Promise.allSettled(entries.map(([, loader]) => loader()))
    if (requestSequence.current !== sequence) return

    const nextSections = {}
    let hasSuccessfulResponse = false
    results.forEach((result, index) => {
      const [key] = entries[index]
      if (result.status === 'fulfilled') {
        hasSuccessfulResponse = true
        nextSections[key] = { loading: false, data: result.value, error: null }
      } else {
        nextSections[key] = { loading: false, data: null, error: describeError(result.reason, '데이터를 불러오지 못했습니다.') }
      }
    })
    setSections(nextSections)
    if (hasSuccessfulResponse) setLastUpdatedAt(new Date())
  }, [])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => (active ? reload({ initial: true }) : null))
    return () => { active = false }
  }, [reload])

  return { sections, lastUpdatedAt, reload }
}
