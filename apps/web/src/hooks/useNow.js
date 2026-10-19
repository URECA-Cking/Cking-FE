import { useEffect, useState } from 'react'

/** 현재 시각(ms)을 intervalMs마다 갱신해 돌려준다. 렌더 중에 Date.now()를 직접 부르지 않고 시간에 따라 바뀌는 화면을 그릴 때 쓴다. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
