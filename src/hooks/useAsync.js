import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError } from '../api/client.js'

/**
 * 비동기 조회 공통 훅. 화면마다 반복되던 loading/error/reload 상태 관리를 한 곳에 모은다.
 *
 * @param {Function} loader 실제 호출 함수(의존성이 바뀌면 다시 실행된다)
 * @param {Array} deps loader가 의존하는 값들
 * @param {{enabled?: boolean, fallbackMessage?: string}} options
 */
export function useAsync(loader, deps = [], { enabled = true, fallbackMessage } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState(null)
  // 언마운트 이후 setState로 경고가 나지 않도록 살아있는 동안만 반영한다.
  const alive = useRef(true)
  const requestSeq = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return null
    }
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      // 더 최신 요청이 시작됐다면 늦게 도착한 응답은 버린다.
      if (alive.current && requestSeq.current === seq) setData(result)
      return result
    } catch (err) {
      if (alive.current && requestSeq.current === seq) setError(describeError(err, fallbackMessage))
      return null
    } finally {
      if (alive.current && requestSeq.current === seq) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run, setData }
}
