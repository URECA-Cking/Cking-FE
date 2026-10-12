import { useCallback, useEffect, useRef } from 'react'
import { sendRecommendationEvents } from '../api/creators.js'
import { newRequestId } from '../api/client.js'

const FLUSH_DELAY_MS = 1500
const BATCH_SIZE = 50
const MAX_ATTEMPTS = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 5xx·네트워크 오류만 같은 eventId로 다시 보낸다. 만료·검증 실패(4xx)는 다시 보내도 같은 결과라 버린다. */
async function sendWithRetry(batch) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      await sendRecommendationEvents(batch)
      return
    } catch (error) {
      const retryable = error?.code === 'NETWORK_ERROR' || error?.status >= 500
      if (!retryable) return
      await sleep(1000 * 2 ** attempt)
    }
  }
}

/**
 * 추천 카드의 노출(IMPRESSION)·클릭(CLICK)을 모아 BE로 보낸다.
 * - 노출은 카드가 화면에 절반 이상 들어왔을 때만, 응답(requestId)당 크리에이터별 한 번 기록한다.
 * - requestId가 null(스냅샷 저장 실패)이면 아무것도 보내지 않는다.
 * - 행동마다 새 eventId를 만들고, 이벤트는 만든 시점의 requestId를 들고 다녀 응답이 바뀌어도 섞이지 않는다.
 * @returns {{ impressionRef: (creatorId: number) => (el: Element|null) => (void|(() => void)), trackClick: (creatorId: number) => void }}
 */
export function useRecommendationEvents(requestId) {
  const state = useRef({ requestId: null, queue: [], seen: new Set(), timer: null, flushing: false, observer: null })

  const flush = useCallback(async () => {
    const s = state.current
    if (s.timer) clearTimeout(s.timer)
    s.timer = null
    if (s.flushing) return
    s.flushing = true
    try {
      while (s.queue.length > 0) {
        await sendWithRetry(s.queue.splice(0, BATCH_SIZE))
      }
    } finally {
      s.flushing = false
    }
  }, [])

  const enqueue = useCallback((creatorId, eventType, delay) => {
    const s = state.current
    if (!s.requestId) return
    s.queue.push({ eventId: newRequestId(), recommendationRequestId: s.requestId, creatorId, eventType })
    if (delay === 0 || s.queue.length >= BATCH_SIZE) flush()
    else if (!s.timer) s.timer = setTimeout(flush, delay)
  }, [flush])

  useEffect(() => {
    const s = state.current
    s.requestId = requestId
    s.seen = new Set()
  }, [requestId])

  useEffect(() => {
    const s = state.current
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      s.observer?.disconnect()
      s.observer = null
      flush()
    }
  }, [flush])

  const impressionRef = useCallback((creatorId) => (el) => {
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const s = state.current
    if (!s.observer) {
      s.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const id = Number(entry.target.dataset.recCreatorId)
          const key = `${s.requestId}:${id}`
          if (s.seen.has(key)) return
          s.seen.add(key)
          enqueue(id, 'IMPRESSION', FLUSH_DELAY_MS)
        })
      }, { threshold: 0.5 })
    }
    el.dataset.recCreatorId = String(creatorId)
    s.observer.observe(el)
    return () => s.observer?.unobserve(el)
  }, [enqueue])

  // 클릭은 화면 이동을 막지 않도록 기다리지 않고 바로 내보낸다.
  const trackClick = useCallback((creatorId) => enqueue(creatorId, 'CLICK', 0), [enqueue])

  return { impressionRef, trackClick }
}
