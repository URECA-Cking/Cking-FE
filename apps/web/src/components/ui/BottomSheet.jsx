import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MaterialIcon from './MaterialIcon.jsx'

// 포털 순서로 중첩 시트를 쌓고 마지막 시트만 키보드 입력을 처리한다.
const sheets = []
let originalOverflow

export default function BottomSheet({ open, ...props }) {
  return open ? <OpenBottomSheet {...props} /> : null
}

function OpenBottomSheet({ onClose, title, eyebrow, children }) {
  const [expanded, setExpanded] = useState(false)
  const panel = useRef(null)
  const drag = useRef(null)
  const dragged = useRef(false)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])

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
        className={`bottom-sheet-panel w-full max-w-[480px] md:max-w-2xl mx-auto bg-surface-container-lowest rounded-t-[28px] shadow-2xl flex flex-col px-space-md md:px-8 pt-space-sm outline-none ${expanded ? 'h-[95dvh] max-h-[95dvh]' : 'max-h-[85dvh]'}`}
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
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return
            dragged.current = false
            drag.current = event.clientY
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) => {
            if (drag.current === null) return
            const distance = drag.current - event.clientY
            drag.current = null
            if (Math.abs(distance) >= 24) {
              dragged.current = true
              setExpanded(distance > 0)
              // 드래그 후 브라우저가 만드는 click이 확장을 다시 뒤집지 않게 한다.
              event.preventDefault()
            }
          }}
          onPointerCancel={() => { drag.current = null }}
        >
          <span className="w-10 h-1 rounded-full bg-surface-container-highest" />
        </button>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {(title || onClose) && (
            <div className="flex items-start justify-between mb-space-md">
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
                  <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface font-extrabold tracking-tight">
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
