import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MaterialIcon from './MaterialIcon.jsx'

// 핸들을 끄는 동안 시트가 손가락을 따라 움직이고, 놓을 때 가까운 쪽(확장·접힘·닫힘)으로 붙는다.
const DRAG_THRESHOLD = 6 // px. 이보다 덜 움직이면 드래그가 아니라 클릭으로 본다.
const FAST_VELOCITY = 0.5 // px/ms. 이보다 빠르게 밀면 거리와 상관없이 그 방향으로 간다.
const CLOSE_DISTANCE = 100 // px. 접힌 시트를 이만큼 이상 내리면 닫는다.
const SNAP_MS = 300
const COLLAPSED_RATIO = 0.85
const EXPANDED_RATIO = 0.95

/** 접힌 상태에서 내용만큼 차지하는 높이(최대 화면의 85%). 잠깐 높이를 auto로 바꿔 재고 되돌린다. */
function collapsedHeightOf(element) {
  const { height, maxHeight, transition } = element.style
  element.style.transition = 'none'
  element.style.height = 'auto'
  element.style.maxHeight = `${window.innerHeight * COLLAPSED_RATIO}px`
  const measured = element.getBoundingClientRect().height
  element.style.height = height
  element.style.maxHeight = maxHeight
  element.style.transition = transition
  return measured
}

// 포털 순서로 중첩 시트를 쌓고 마지막 시트만 키보드 입력을 처리한다.
const sheets = []
let originalOverflow

export default function BottomSheet({ open, ...props }) {
  return open ? <OpenBottomSheet {...props} /> : null
}

function OpenBottomSheet({ onClose, title, eyebrow, compactTitle = false, children }) {
  const [expanded, setExpanded] = useState(false)
  const panel = useRef(null)
  const drag = useRef(null)
  const dragged = useRef(false)
  const settleTimer = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  /** 드래그 중에 붙인 인라인 스타일을 지워 클래스(확장·접힘)가 다시 높이를 정하게 한다. */
  function resetInline() {
    const element = panel.current
    if (!element) return
    element.style.transition = ''
    element.style.height = ''
    element.style.maxHeight = ''
    element.style.transform = ''
  }

  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return
    const element = panel.current
    window.clearTimeout(settleTimer.current)
    dragged.current = false
    drag.current = {
      startY: event.clientY,
      startHeight: element.getBoundingClientRect().height,
      collapsedHeight: collapsedHeightOf(element),
      maxHeight: window.innerHeight * EXPANDED_RATIO,
      height: 0,
      offset: 0,
      velocity: 0,
      lastY: event.clientY,
      lastTime: event.timeStamp,
    }
    drag.current.height = drag.current.startHeight
    element.style.transition = 'none'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event) {
    const state = drag.current
    if (!state) return
    const element = panel.current
    const distance = state.startY - event.clientY // 위로 끌면 양수
    const raw = state.startHeight + distance
    // 위로는 높이가 늘고(최대 95%), 접힌 높이보다 아래로는 시트 전체가 내려간다.
    state.height = Math.min(state.maxHeight, Math.max(state.collapsedHeight, raw))
    state.offset = Math.max(0, state.collapsedHeight - raw)
    const elapsed = Math.max(1, event.timeStamp - state.lastTime)
    state.velocity = state.velocity * 0.5 + ((state.lastY - event.clientY) / elapsed) * 0.5
    state.lastY = event.clientY
    state.lastTime = event.timeStamp
    if (Math.abs(distance) >= DRAG_THRESHOLD) dragged.current = true
    element.style.maxHeight = `${state.maxHeight}px`
    element.style.height = `${state.height}px`
    element.style.transform = state.offset > 0 ? `translateY(${state.offset}px)` : ''
  }

  function endDrag(event) {
    const state = drag.current
    if (!state) return
    drag.current = null
    const element = panel.current
    // 거의 안 움직였으면 클릭이다. 인라인 스타일만 정리하고 클릭 핸들러가 확장을 토글하게 둔다.
    if (!dragged.current) {
      resetInline()
      return
    }
    // 드래그 후 브라우저가 만드는 click이 확장을 다시 뒤집지 않게 한다.
    event.preventDefault()
    let target
    if (state.offset > 0) {
      target = close.current && (state.offset > CLOSE_DISTANCE || state.velocity < -FAST_VELOCITY) ? 'close' : 'collapsed'
    } else if (state.velocity > FAST_VELOCITY) target = 'expanded'
    else if (state.velocity < -FAST_VELOCITY) target = 'collapsed'
    else target = state.height > (state.collapsedHeight + state.maxHeight) / 2 ? 'expanded' : 'collapsed'

    element.style.transition = '' // CSS의 전환이 다시 적용돼 목표 위치까지 부드럽게 붙는다.
    if (target === 'close') {
      element.style.transform = 'translateY(100%)'
      settleTimer.current = window.setTimeout(() => close.current?.(), SNAP_MS - 80)
      return
    }
    const next = target === 'expanded'
    element.style.transform = ''
    element.style.height = `${next ? state.maxHeight : state.collapsedHeight}px`
    setExpanded(next)
    settleTimer.current = window.setTimeout(resetInline, SNAP_MS + 40)
  }

  useEffect(() => {
    const element = panel.current
    const previousFocus = document.activeElement
    if (sheets.length === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    sheets.push(element)
    element.focus()
    function onKeyDown(event) {
      if (sheets.at(-1) !== element) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current?.()
      }
      if (event.key === 'Tab') {
        const focusable = [...element.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
          .filter((node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0)
        const first = focusable[0]
        const last = focusable.at(-1)
        if (!first) { event.preventDefault(); element.focus() }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
          event.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      sheets.splice(sheets.indexOf(element), 1)
      if (sheets.length === 0) document.body.style.overflow = originalOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return createPortal(
    <div
      className="bottom-sheet-backdrop fixed inset-0 z-[80] bg-black/60 flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title || '상세 정보'}
        tabIndex={-1}
        className={`bottom-sheet-panel w-full max-w-[480px] md:max-w-2xl mx-auto bg-surface-container-lowest rounded-t-[28px] shadow-2xl flex flex-col px-space-md md:px-8 pt-space-sm outline-none ${expanded ? 'h-[95dvh] max-h-[95dvh]' : 'h-auto max-h-[85dvh]'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={expanded ? '시트 접기' : '시트 확장'}
          aria-expanded={expanded}
          className="w-full shrink-0 flex items-center justify-center py-3 mb-space-xs touch-none cursor-ns-resize"
          onClick={(event) => {
            if (event.detail === 0 || !dragged.current) setExpanded((value) => !value)
            dragged.current = false
          }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={() => { drag.current = null; resetInline() }}
        >
          <span className="w-10 h-1 rounded-full bg-surface-container-highest" />
        </button>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {(title || onClose) && (
            <div className={`flex items-start justify-between ${compactTitle ? 'mb-1' : 'mb-space-md'}`}>
              <div>
                {eyebrow && (
                  <div className="inline-flex items-center gap-space-xs mb-1">
                    <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
                    <span className="font-label-xs text-label-xs text-primary-container font-bold uppercase tracking-wide">
                      {eyebrow}
                    </span>
                  </div>
                )}
                {title && (
                  <h2 className={`${compactTitle ? 'text-[22px] leading-[30px]' : 'font-headline-xl-mobile text-headline-xl-mobile'} text-on-surface font-extrabold tracking-tight`}>
                    {title}
                  </h2>
                )}
              </div>
              {onClose && (
                <button
                  aria-label="닫기"
                  className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  onClick={onClose}
                  type="button"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              )}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
