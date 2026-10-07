import { useCallback, useEffect, useRef, useState } from 'react'

/** 오류 문구 정책은 각 앱에서 주입하고 조회 상태 관리만 공유한다. */
export function createUseAsync(describeError) {
  return function useAsync(loader, deps = [], { enabled = true, fallbackMessage } = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(Boolean(enabled))
    const [error, setError] = useState(null)
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
}
