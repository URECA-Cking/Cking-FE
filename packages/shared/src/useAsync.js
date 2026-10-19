import { useCallback, useEffect, useRef, useState } from 'react'

// cacheKey를 준 조회의 마지막 성공 결과. 화면을 다시 열 때 먼저 보여 주고 뒤에서 새로 불러온다.
const responseCache = new Map()

/**
 * 화면용 오류 문구와 도메인 분기용 원본 오류를 함께 관리하는 조회 훅을 만든다.
 * cacheKey를 주면 같은 키의 마지막 성공 결과를 바로 보여 주고(로딩 표시 없이) 뒤에서 다시 불러와 최신 값으로 바꾼다.
 * 키에는 회원 번호처럼 결과를 가르는 값을 모두 넣어, 다른 회원의 결과가 섞이지 않게 한다.
 */
export function createUseAsync(describeError) {
  return function useAsync(loader, deps = [], { enabled = true, fallbackMessage, cacheKey = null } = {}) {
    const cachedAtMount = cacheKey != null ? responseCache.get(cacheKey) : undefined
    const [data, setData] = useState(cachedAtMount ?? null)
    const [loading, setLoading] = useState(Boolean(enabled) && cachedAtMount === undefined)
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
      // 캐시된 결과가 있으면 그것을 보여 주고 로딩 표시 없이 새로 불러온다.
      const cached = cacheKey != null ? responseCache.get(cacheKey) : undefined
      if (cached !== undefined) setData(cached)
      setLoading(cached === undefined)
      setError(null)
      setErrorObject(null)
      try {
        const result = await loader()
        if (cacheKey != null) responseCache.set(cacheKey, result)
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
    }, [enabled, cacheKey, ...deps])

    useEffect(() => {
      run()
    }, [run])

    return { data, loading, error, errorObject, reload: run, setData }
  }
}
