import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { SWIPE_REVEAL, clampSwipeOffset, isDeleteSwipe, swipeAxis, swipeOutcome } from '../../utils/swipeToHide.js'

/**
 * 카드를 왼쪽으로 밀면 "삭제" 버튼이 드러나고, 버튼을 눌러야 삭제한다. 끝까지(카드 너비의 일정 비율 이상) 밀고 놓으면 버튼 없이 바로 삭제한다.
 * 서버에는 숨김으로 기록하며 되돌릴 수 없다. 터치와 마우스 모두 포인터 이벤트로 처리하고, 세로 스크롤은 브라우저에 맡기고(touch-action: pan-y) 가로 이동만 가져온다.
 * 열림 여부(open)는 부모가 들고 있어 한 번에 하나의 카드만 열 수 있다. 밀었다 놓은 직후의 클릭은 카드의 동작(알림 열기)으로 보내지 않는다.
 * 열려 있는 동안 Esc를 누르면 닫는다. 키보드로 삭제하는 동작은 제공하지 않는다.
 * 삭제는 손을 놓았을 때(pointerup)만 확정한다. 브라우저·OS가 입력을 취소(pointercancel)하면 삭제하지 않고 카드를 원래 자리로 되돌린다.
 */
export default function SwipeToHide({ open, onOpenChange, onHide, hiding = false, disabled = false, label, children }) {
  const [dragOffset, setDragOffset] = useState(null)
  const [cardWidth, setCardWidth] = useState(0)
  const cardRef = useRef(null)
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
  const willDelete = dragOffset !== null && isDeleteSwipe(dragOffset, cardWidth)

  function onPointerDown(event) {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    const width = cardRef.current?.offsetWidth ?? 0
    setCardWidth(width)
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: resting, width, axis: null }
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
    // 바로 삭제할 수 있도록 카드 너비까지 끌 수 있다. 놓는 순간의 값은 렌더를 기다리지 않고 ref에 둔다(이벤트가 몰려 와도 마지막 위치를 쓴다).
    current.latest = clampSwipeOffset(current.offset, dx, current.width || SWIPE_REVEAL)
    setDragOffset(current.latest)
  }

  function finish(event) {
    const current = start.current
    if (!current || current.id !== event.pointerId) return
    start.current = null
    if (current.axis !== 'x') return
    const outcome = swipeOutcome(current.latest ?? resting, current.width)
    setDragOffset(null)
    if (outcome === 'delete') {
      onOpenChange(false)
      onHide()
      return
    }
    onOpenChange(outcome === 'open')
  }

  /**
   * 브라우저·OS가 입력을 취소한 경우(pointercancel)다. 사용자가 놓은 것이 아니라서 삭제를 확정하지 않고 카드를 원래 자리로 되돌린다.
   * 삭제는 되돌릴 수 없으므로 끝까지 끌던 중에 취소돼도 삭제하지 않는다.
   */
  function cancel(event) {
    const current = start.current
    if (!current || current.id !== event.pointerId) return
    start.current = null
    setDragOffset(null)
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
        // 끝까지 끌면 버튼이 카드가 비운 만큼 늘어나 "놓으면 삭제"가 보인다.
        style={{ width: Math.max(SWIPE_REVEAL, -offset) }}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-error text-on-error font-label-xs text-label-xs font-semibold disabled:opacity-60"
      >
        <MaterialIcon name="delete" className={`text-[20px] transition-transform ${willDelete ? 'scale-125' : ''}`} />
        {hiding ? '삭제하는 중' : willDelete ? '놓으면 삭제' : '삭제'}
      </button>
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onClickCapture={onClickCapture}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        className={`relative ${dragOffset === null ? 'transition-transform duration-200 ease-out' : 'select-none'}`}
      >
        {children}
      </div>
    </div>
  )
}
