import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/explore', label: '탐색', icon: 'explore' },
  { to: '/my-entries', label: '내 응모', icon: 'confirmation_number' },
  { to: '/my-page', label: 'MY', icon: 'person' },
]

const INDICATOR_MOTION_MS = 380

/** 시안의 프로스티드 글래스 하단 독. 알림은 앱바에서 연다. */
export default function BottomNav({ embedded = false, compact = false }) {
  const { pathname } = useLocation()
  const dockRef = useRef(null)
  const itemRefs = useRef([])
  const previousIndex = useRef(null)
  const pulseTimerRef = useRef(null)
  const [indicator, setIndicator] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [motion, setMotion] = useState(null)
  const [isPulsing, setIsPulsing] = useState(false)
  const activeIndex = NAV_ITEMS.findIndex((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)))

  useLayoutEffect(() => {
    const dock = dockRef.current
    const activeItem = itemRefs.current[activeIndex]
    if (!dock || !activeItem) return undefined

    const measure = () => {
      const dockBounds = dock.getBoundingClientRect()
      const itemBounds = activeItem.getBoundingClientRect()
      const verticalInset = Math.round(Math.min(7, Math.max(5, dockBounds.height * 0.11)))
      const topInset = Math.max(3, verticalInset - 2)
      const outerInset = 2
      const width = Math.max(0, itemBounds.width - outerInset * 2)
      const height = Math.max(0, dockBounds.height - topInset - verticalInset)
      const cellLeft = itemBounds.left - dockBounds.left
      const left = cellLeft + (itemBounds.width - width) / 2

      setIndicator({
        left,
        top: topInset,
        width,
        height,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(dock)
    observer.observe(activeItem)
    return () => observer.disconnect()
  }, [activeIndex, compact])

  useEffect(() => {
    if (previousIndex.current === null) {
      previousIndex.current = activeIndex
      return undefined
    }
    if (previousIndex.current === activeIndex) return undefined

    const direction = activeIndex > previousIndex.current ? 'right' : 'left'
    previousIndex.current = activeIndex
    setMotion(direction)
    const timer = window.setTimeout(() => setMotion(null), INDICATOR_MOTION_MS)
    return () => window.clearTimeout(timer)
  }, [activeIndex])

  useEffect(() => () => window.clearTimeout(pulseTimerRef.current), [])

  const pulseDock = () => {
    setIsPulsing(false)
    window.requestAnimationFrame(() => setIsPulsing(true))
    window.clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = window.setTimeout(() => setIsPulsing(false), 220)
  }

  return (
    <nav
      className={
        embedded
          ? 'fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] md:max-w-none md:px-6'
          : 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pb-safe bg-surface-container/90 backdrop-blur-xl shadow-dock'
      }
    >
      <div
        ref={dockRef}
        className={`liquid-nav-dock mx-auto grid grid-cols-4 items-center rounded-full transition-[width,height,padding,gap] duration-300 ease-out ${
          isPulsing ? 'is-pulsing' : ''
        } ${
          compact
            ? 'h-11 w-[20.5rem] max-w-full gap-1 px-0'
            : 'h-[3.25rem] w-full max-w-[28rem] gap-3 px-0'
        } relative`}
      >
        <span
          aria-hidden="true"
          className={`liquid-nav-indicator pointer-events-none absolute rounded-full ${
            motion ? `is-moving is-moving-${motion}` : ''
          } ${indicator.width ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: 0,
            width: indicator.width,
            height: indicator.height,
            top: indicator.top,
            transform: `translate3d(${indicator.left}px, 0, 0)`,
          }}
        />
        {NAV_ITEMS.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={pulseDock}
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            className={({ isActive }) =>
              `relative z-10 flex flex-1 flex-col items-center justify-center min-w-0 rounded-full transition-[height,color] duration-300 ease-out active:scale-95 ${
                compact ? 'h-8 gap-0' : 'h-10 gap-0'
              } ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <MaterialIcon name={item.icon} filled={isActive} className={compact ? 'text-[21px]' : 'text-[24px]'} />
                </span>
                <span className={`relative -mt-1 font-label-xs transition-[font-size] duration-300 ${compact ? 'text-[9px] leading-3' : 'text-label-xs'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
