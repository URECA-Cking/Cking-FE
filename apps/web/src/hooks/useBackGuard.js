import { useCallback, useEffect, useRef } from 'react'

// 가드 항목임을 표시하는 history.state 키. react-router의 idx·key는 그대로 두므로 앱 안 뒤로가기 판단(canGoBackInApp)이 변하지 않는다.
const GUARD_KEY = 'backGuard'
// 되감는 popstate가 끝내 오지 않아도 흐름이 멈추지 않도록 기다리는 최대 시간.
const REWIND_TIMEOUT_MS = 300

/** 지금 history 위치가 가드 항목인지. */
function atGuardEntry() {
  return window.history.state?.[GUARD_KEY] === true
}

/**
 * 화면 뒤로가기 가드: 브라우저·기기 뒤로가기(스와이프, 안드로이드 뒤로가기 버튼 등)를 헤더 뒤로가기와 같은 동작으로 받는다.
 * 이런 뒤로가기는 앱 코드를 거치지 않고 브라우저가 history를 되돌리므로, 켜져 있는 동안 현재 화면 위에
 * 가드 항목을 하나 더 쌓아 두고, 그 항목이 빠지는 순간(popstate) 항목을 다시 쌓은 뒤 `onBack`을 부른다.
 * 화면은 한 번도 떠나지 않으므로 `onBack`이 확인 시트를 열면 그대로 머문다.
 *
 * 가드 항목은 이 화면을 떠나거나 다른 단계로 넘어갈 때 반드시 `leave`·`release`로 걷어낸다.
 * 가드 항목 위에서 이동하면 가드 아래의 원래 화면 항목이 남아, 이동한 화면에서 뒤로가기를 눌렀을 때 이 화면이 되살아난다.
 * 언마운트 때 자동으로 걷지 않는 것은, 라우터 이동으로 이미 다른 화면에 있을 때 되감으면 이동한 화면까지 되돌려 버리기 때문이다.
 *
 * @param {boolean} enabled 가드를 켜는지. 꺼져도 이미 쌓인 가드 항목은 그대로 둔다(다른 단계로 갔다 돌아올 수 있다).
 * @param {() => void} onBack 가드된 뒤로가기가 눌렸을 때 할 일
 * @returns {{ release: () => Promise<void>, leave: (extra?: number) => Promise<void> }} 가드 항목을 걷는 함수들
 */
export function useBackGuard(enabled, onBack) {
  const onBackRef = useRef(onBack)
  // 진행 중인 되감기를 끝내는 함수. 있는 동안 들어오는 popstate는 뒤로가기 입력이 아니라 우리가 낸 것이므로 무시한다.
  const rewinding = useRef(null)
  // 화면을 떠나는 중이면 되감은 뒤 단계가 바뀌어도 가드를 다시 쌓지 않는다.
  const leaving = useRef(false)

  useEffect(() => {
    onBackRef.current = onBack
  })

  useEffect(() => {
    if (!enabled || leaving.current) return undefined
    // 이미 가드 항목 위에 있으면(단계를 갔다 돌아온 경우, StrictMode의 재실행) 또 쌓지 않는다.
    if (!atGuardEntry()) window.history.pushState({ ...window.history.state, [GUARD_KEY]: true }, '')

    /** 가드 항목이 빠져 원래 화면 항목으로 돌아왔으면, 항목을 다시 쌓고 뒤로가기 입력을 알린다. */
    function onPop() {
      if (rewinding.current || atGuardEntry()) return
      window.history.pushState({ ...window.history.state, [GUARD_KEY]: true }, '')
      onBackRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [enabled])

  // 되감는 도중 언마운트되면 걸어 둔 리스너와 타이머를 거둔다.
  useEffect(() => () => rewinding.current?.(), [])

  /**
   * 맨 위 가드 항목(있으면)과 `extra`개의 항목을 한 번에 되감고, 되돌리는 popstate가 오면 끝난다.
   * popstate가 늦어도 타이머로 먼저 끝나지만, 리스너는 그 popstate를 받을 때까지 남겨 늦게 온 것을 입력으로 오인하지 않는다.
   * 되감을 항목이 없으면 바로 끝난다. `leave`이면 화면을 떠나는 중이라 이후 가드를 다시 쌓지 않는다.
   */
  const rewind = useCallback((extra, leave) => {
    const steps = (atGuardEntry() ? 1 : 0) + extra
    if (leave) leaving.current = true
    if (steps <= 0) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, REWIND_TIMEOUT_MS)
      const cancel = () => {
        window.removeEventListener('popstate', onPopOnce)
        window.clearTimeout(timer)
        rewinding.current = null
      }
      function onPopOnce() {
        cancel()
        resolve()
      }
      rewinding.current = cancel
      window.addEventListener('popstate', onPopOnce)
      window.history.go(-steps)
    })
  }, [])

  /** 같은 화면에서 다른 단계로 넘어가기 전에 맨 위 가드 항목만 걷는다. 단계를 되돌아오면 가드를 다시 쌓는다. */
  const release = useCallback(() => rewind(0, false), [rewind])
  /** 화면을 떠나기 전에 가드 항목과 이 화면이 쌓은 `extra`개의 항목을 되감는다. */
  const leave = useCallback((extra = 0) => rewind(extra, true), [rewind])

  return { release, leave }
}
