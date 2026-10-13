import { useCallback, useEffect, useRef, useState } from 'react'

/** 화면용 오류 문구와 도메인 분기용 원본 오류를 함께 관리하는 조회 훅을 만든다. */
export function createUseAsync(describeError) {
  return function useAsync(loader, deps = [], { enabled = true, fallbackMessage } = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(Boolean(enabled))
    const [error, setError] = useState(null)
    const [errorObject, setErrorObject] = useState(null)
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
      setErrorObject(null)
      try {
        const result = await loader()
        if (alive.current && requestSeq.current === seq) setData(result)
        return result
      } catch (err) {
        if (alive.current && requestSeq.current === seq) {
          setError(describeError(err, fallbackMessage))
          setErrorObject(err)
        }
        return null
      } finally {
        if (alive.current && requestSeq.current === seq) setLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps])

    useEffect(() => {
      run()
    }, [run])

    return { data, loading, error, errorObject, reload: run, setData }
  }
}
