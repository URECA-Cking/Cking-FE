import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { SWIPE_REVEAL, clampSwipeOffset, settleSwipe, swipeAxis } from '../../utils/swipeToHide.js'

/**
 * 카드를 왼쪽으로 밀면 "숨기기" 버튼이 드러나고, 버튼을 눌러야 숨긴다(밀기만으로는 숨기지 않는다).
 * 터치와 마우스 모두 포인터 이벤트로 처리한다. 세로 스크롤은 브라우저에 맡기고(touch-action: pan-y) 가로 이동만 가져온다.
 * 열림 여부(open)는 부모가 들고 있어 한 번에 하나의 카드만 열 수 있다. 밀었다 놓은 직후의 클릭은 카드의 동작(알림 열기)으로 보내지 않는다.
 * 열려 있는 동안 Esc를 누르면 닫는다. 키보드로 숨기는 동작은 제공하지 않는다.
 */
export default function SwipeToHide({ open, onOpenChange, onHide, hiding = false, disabled = false, label, children }) {
  const [dragOffset, setDragOffset] = useState(null)
  const start = useRef(null)
  const moved = useRef(false)

  // 열린 카드는 Esc로 닫는다.
  useEffect(() => {
    if (!open) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, onOpenChange])

  const resting = open ? -SWIPE_REVEAL : 0
  const offset = dragOffset ?? resting

  function onPointerDown(event) {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: resting, axis: null }
    moved.current = false
  }

  function onPointerMove(event) {
    const current = start.current
    if (!current || current.id !== event.pointerId) return
    const dx = event.clientX - current.x
    if (current.axis === null) {
      current.axis = swipeAxis(dx, event.clientY - current.y)
      if (current.axis === null) return
      if (current.axis === 'y') {
        start.current = null // 세로 스크롤이다. 이번 터치는 건드리지 않는다.
        return
      }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    moved.current = true
    setDragOffset(clampSwipeOffset(current.offset, dx))
  }

  function finish(event) {
    const current = start.current
    if (!current || current.id !== event.pointerId) return
    start.current = null
    if (current.axis !== 'x') return
    const settled = settleSwipe(dragOffset ?? resting)
    setDragOffset(null)
    onOpenChange(settled !== 0)
  }

  /** 끌었다 놓은 직후의 클릭과, 열린 카드를 누르는 클릭은 카드 동작 대신 닫기만 한다. */
  function onClickCapture(event) {
    if (!moved.current && !open) return
    event.preventDefault()
    event.stopPropagation()
    if (!moved.current && open) onOpenChange(false)
    moved.current = false
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      <button
        type="button"
        onClick={onHide}
        disabled={hiding || disabled || !open}
        tabIndex={-1}
        aria-hidden={!open}
        aria-label={label}
        style={{ width: SWIPE_REVEAL }}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-error text-on-error font-label-xs text-label-xs font-semibold disabled:opacity-60"
      >
        <MaterialIcon name="visibility_off" className="text-[20px]" />
        {hiding ? '숨기는 중' : '숨기기'}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        className={`relative ${dragOffset === null ? 'transition-transform duration-200 ease-out' : 'select-none'}`}
      >
        {children}
      </div>
    </div>
  )
}
