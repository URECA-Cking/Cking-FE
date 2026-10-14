import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const TOP_THRESHOLD = 8
const DIRECTION_THRESHOLD = 18

/** 스크롤 방향 판정에 필요한 이전 위치와 누적 이동 거리를 만든다. */
export function createScrollChromeTracker(scrollTop = 0) {
  return { lastScrollTop: scrollTop, pendingDistance: 0, pendingDirection: null }
}

/** 프로그램으로 스크롤 위치를 바꾼 뒤 다음 scroll 이벤트가 사용자 이동으로 해석되지 않게 기준값을 맞춘다. */
export function synchronizeScrollChromeTracker(tracker, scrollTop) {
  tracker.lastScrollTop = scrollTop
  tracker.pendingDistance = 0
  tracker.pendingDirection = null
}

/** 현재 스크롤 위치를 반영하고, 앱 크롬 표시 상태 변경이 필요할 때만 반환한다. */
export function resolveScrollChrome(tracker, scrollTop) {
  if (scrollTop <= TOP_THRESHOLD) {
    synchronizeScrollChromeTracker(tracker, scrollTop)
    return { headerVisible: true, bottomCompact: false }
  }

  const delta = scrollTop - tracker.lastScrollTop
  tracker.lastScrollTop = scrollTop
  if (Math.abs(delta) < 1) return null

  const direction = delta > 0 ? 'down' : 'up'
  if (direction !== tracker.pendingDirection) {
    tracker.pendingDirection = direction
    tracker.pendingDistance = Math.abs(delta)
  } else {
    tracker.pendingDistance += Math.abs(delta)
  }

  if (tracker.pendingDistance < DIRECTION_THRESHOLD) return null

  tracker.pendingDistance = 0
  return { headerVisible: direction === 'up', bottomCompact: direction === 'down' }
}

/**
 * MainLayout의 스크롤 컨테이너에서만 방향을 관찰한다.
 * requestAnimationFrame 안에서 읽고, 상태가 달라질 때만 React 상태를 갱신한다.
 */
export function useScrollChrome(scrollRef) {
  const [chrome, setChrome] = useState({ headerVisible: true, bottomCompact: false })
  const trackerRef = useRef(null)

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined

    let frameId = null
    const tracker = createScrollChromeTracker(element.scrollTop)
    trackerRef.current = tracker

    const setState = (headerVisible, bottomCompact) => {
      setChrome((current) =>
        current.headerVisible === headerVisible && current.bottomCompact === bottomCompact
          ? current
          : { headerVisible, bottomCompact },
      )
    }

    const update = () => {
      frameId = null
      const nextChrome = resolveScrollChrome(tracker, element.scrollTop)
      if (nextChrome) setState(nextChrome.headerVisible, nextChrome.bottomCompact)
    }

    const onScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(update)
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      if (trackerRef.current === tracker) trackerRef.current = null
    }
  }, [scrollRef])

  /** 프로그램 스크롤 뒤 감지 기준값과 앱 크롬을 함께 기본 표시 상태로 맞춘다. */
  const resetChrome = useCallback(
    (scrollTop = scrollRef.current?.scrollTop ?? 0) => {
      if (trackerRef.current) synchronizeScrollChromeTracker(trackerRef.current, scrollTop)
      setChrome({ headerVisible: true, bottomCompact: false })
    },
    [scrollRef],
  )

  return { ...chrome, resetChrome }
}
