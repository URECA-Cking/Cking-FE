import { useEffect, useState } from 'react'

const TOP_THRESHOLD = 8
const DIRECTION_THRESHOLD = 18

/**
 * MainLayout의 스크롤 컨테이너에서만 방향을 관찰한다.
 * requestAnimationFrame 안에서 읽고, 상태가 달라질 때만 React 상태를 갱신한다.
 */
export function useScrollChrome(scrollRef) {
  const [chrome, setChrome] = useState({ headerVisible: true, bottomCompact: false })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined

    let frameId = null
    let lastScrollTop = element.scrollTop
    let pendingDistance = 0
    let pendingDirection = null

    const setState = (headerVisible, bottomCompact) => {
      setChrome((current) =>
        current.headerVisible === headerVisible && current.bottomCompact === bottomCompact
          ? current
          : { headerVisible, bottomCompact },
      )
    }

    const update = () => {
      frameId = null
      const scrollTop = element.scrollTop

      if (scrollTop <= TOP_THRESHOLD) {
        lastScrollTop = scrollTop
        pendingDistance = 0
        pendingDirection = null
        setState(true, false)
        return
      }

      const delta = scrollTop - lastScrollTop
      lastScrollTop = scrollTop
      if (Math.abs(delta) < 1) return

      const direction = delta > 0 ? 'down' : 'up'
      if (direction !== pendingDirection) {
        pendingDirection = direction
        pendingDistance = Math.abs(delta)
      } else {
        pendingDistance += Math.abs(delta)
      }

      if (pendingDistance >= DIRECTION_THRESHOLD) {
        setState(direction === 'up', direction === 'down')
        pendingDistance = 0
      }
    }

    const onScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(update)
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [scrollRef])

  return chrome
}
