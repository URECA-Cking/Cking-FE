import { useCallback, useEffect, useRef, useState } from 'react'

// cacheKey를 준 조회의 마지막 성공 결과. 화면을 다시 열 때 먼저 보여 주고 뒤에서 새로 불러온다.
const responseCache = new Map()

// 캐시를 비운 횟수. 요청이 시작된 뒤 캐시가 비워졌다면 그 요청의 결과는 이전 세션의 것이라 저장하지도 화면에 쓰지도 않는다.
let cacheEpoch = 0

/**
 * 캐시된 조회 결과를 모두 비운다. 로그아웃처럼 이전 사용자의 결과가 남으면 안 될 때 부른다.
 * 비우기 전에 시작해 아직 진행 중인 요청이 나중에 끝나도 그 결과는 캐시에 다시 저장되지 않는다.
 */
export function clearAsyncCache() {
  cacheEpoch += 1
  responseCache.clear()
}

/**
 * 화면용 오류 문구와 도메인 분기용 원본 오류를 함께 관리하는 조회 훅을 만든다.
 * cacheKey를 주면 같은 키의 마지막 성공 결과를 바로 보여 주고(로딩 표시 없이) 뒤에서 다시 불러와 최신 값으로 바꾼다.
 * 키에는 회원 번호처럼 결과를 가르는 값을 모두 넣어, 다른 회원의 결과가 섞이지 않게 한다.
 * 키가 바뀌면 이전 키의 결과는 바로 비우고(새 키의 캐시가 있으면 그것을 보여 준다), 비로그인처럼 키를 만들 수 없을 때는 null을 준다.
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

    // 키가 바뀐 렌더에서 바로 이전 키의 결과를 걷어낸다. 효과를 기다리면 다른 회원의 결과가 한 번 그려질 수 있다.
    const [renderedKey, setRenderedKey] = useState(cacheKey)
    if (renderedKey !== cacheKey) {
      const nextCached = cacheKey != null ? responseCache.get(cacheKey) : undefined
      setRenderedKey(cacheKey)
      setData(nextCached ?? null)
      setLoading(Boolean(enabled) && nextCached === undefined)
      setError(null)
      setErrorObject(null)
    }

    useEffect(() => {
      alive.current = true
      return () => {
        alive.current = false
      }
    }, [])

    const run = useCallback(async () => {
      if (!enabled) {
        // 비활성화되면 진행 중이던 이전 요청의 결과가 뒤늦게 현재 상태를 덮어쓰지 못하게 무효화한다.
        requestSeq.current += 1
        setLoading(false)
        return null
      }
      const seq = requestSeq.current + 1
      requestSeq.current = seq
      const epoch = cacheEpoch
      const isStale = () => !alive.current || requestSeq.current !== seq || epoch !== cacheEpoch
      // 캐시된 결과가 있으면 그것을 보여 주고 로딩 표시 없이 새로 불러온다.
      const cached = cacheKey != null ? responseCache.get(cacheKey) : undefined
      if (cached !== undefined) setData(cached)
      else if (cacheKey != null) setData(null)
      setLoading(cached === undefined)
      setError(null)
      setErrorObject(null)
      try {
        const result = await loader()
        // 캐시가 비워진 뒤에 끝난 이전 세션의 요청은 저장하지 않는다.
        if (cacheKey != null && epoch === cacheEpoch) responseCache.set(cacheKey, result)
        if (!isStale()) setData(result)
        return result
      } catch (err) {
        if (!isStale()) {
          setError(describeError(err, fallbackMessage))
          setErrorObject(err)
        }
        return null
      } finally {
        if (!isStale()) setLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey, ...deps])

    useEffect(() => {
      run()
      // 조건(enabled·cacheKey·deps)이 바뀌어 run이 교체되거나 화면이 내려가면 이전 조건의 진행 중 요청을 무효화한다.
      return () => {
        requestSeq.current += 1
      }
    }, [run])

    return { data, loading, error, errorObject, reload: run, setData }
  }
}
