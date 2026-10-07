import { useEffect, useState } from 'react'

/** 화면에 들어온 카드의 creatorId를 기록한다. 가로 스크롤 밖의 카드는 조회하지 않는다. */
export function useVisibleCreatorIds(containerRef, renderedIds) {
  const [visibleIds, setVisibleIds] = useState([])
  const renderedKey = renderedIds.join(',')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const cards = container.querySelectorAll('[data-balance-creator-id]')
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleIds((current) => [...new Set([...current, ...renderedIds])])
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      const appeared = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => Number(entry.target.dataset.balanceCreatorId))
      if (appeared.length > 0) {
        setVisibleIds((current) => [...new Set([...current, ...appeared])])
      }
    }, { rootMargin: '0px' })
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
    // The key tracks the rendered card IDs while keeping the effect stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, renderedKey])

  return visibleIds
}
