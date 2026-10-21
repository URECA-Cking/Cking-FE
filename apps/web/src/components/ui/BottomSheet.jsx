import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MaterialIcon from './MaterialIcon.jsx'

// 핸들을 끄는 동안 시트가 손가락을 따라 움직이고, 놓을 때 가까운 쪽(확장·접힘·닫힘)으로 붙는다.
const DRAG_THRESHOLD = 6 // px. 이보다 덜 움직이면 드래그가 아니라 클릭으로 본다.
const FAST_VELOCITY = 0.5 // px/ms. 이보다 빠르게 밀면 거리와 상관없이 그 방향으로 간다.
const CLOSE_DISTANCE = 100 // px. 접힌 시트를 이만큼 이상 내리면 닫는다.
const SNAP_DISTANCE = 40 // px. 속도와 상관없이 이만큼 이상 끌면 그 방향(확장·접힘)으로 간다. 그보다 덜 끌면 제자리로 돌아간다.
const SNAP_MS = 300
const EXIT_MS = 260
const COLLAPSED_RATIO = 0.85
const EXPANDED_RATIO = 0.95

/**
 * 시트가 사라지는 순간 그 모습을 복사해 아래로 내려보내며 지운다. 닫는 방법(닫기 버튼·바깥 누르기·ESC·드래그)이나
 * 부모가 컴포넌트째 지우는 경우와 상관없이 같은 효과를 내려고, 컴포넌트가 사라질 때 한 곳에서 처리한다.
 * 복사본은 클릭(pointer-events)·초점·스크린리더에서 빼고 EXIT_MS 뒤에 지운다. 모션을 줄인 환경에서는 쓰지 않는다.
 * 복사는 DOM이 아직 붙어 있을 때 하지만, 화면에 붙이는 건 정리 함수가 끝난 뒤 원본이 실제로 떨어졌는지 보고 정한다.
 * StrictMode(개발 환경)는 시트를 닫지 않고도 효과의 정리 함수를 한 번 돌리는데, 그때는 원본이 그대로 붙어 있어 복사본을 버린다.
 */
function playExitAnimation(backdrop) {
  if (!backdrop?.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { ghost, panel, scrolls } = cloneForExit(backdrop)
  queueMicrotask(() => {
    if (backdrop.isConnected) return
    startExit(ghost, panel, scrolls)
  })
}

function cloneForExit(backdrop) {
  const ghost = backdrop.cloneNode(true)
  const sourceNodes = [backdrop, ...backdrop.querySelectorAll('*')]
  const ghostNodes = [ghost, ...ghost.querySelectorAll('*')]
  const scrolls = []
  sourceNodes.forEach((node, index) => {
    const copy = ghostNodes[index]
    if (node.scrollTop > 0) scrolls.push([copy, node.scrollTop])
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      copy.value = node.value
      if (node instanceof HTMLInputElement) copy.checked = node.checked
    }
    if (copy.matches?.('button, a[href], input, select, textarea, [tabindex]')) copy.tabIndex = -1
    copy.style.pointerEvents = 'none' // fixed inset-0 복사본이 사라지는 동안 뒤의 화면(중첩된 아래 시트 포함)을 누르지 못하게 막지 않도록
  })
  const panel = ghost.querySelector('[role="dialog"]')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.animation = 'none'
  if (panel) {
    panel.removeAttribute('role')
    panel.removeAttribute('aria-modal')
    panel.removeAttribute('aria-label')
    panel.style.animation = 'none'
  }
  return { ghost, panel, scrolls }
}

function startExit(ghost, panel, scrolls) {
  document.body.appendChild(ghost)
  scrolls.forEach(([node, top]) => { node.scrollTop = top })
  ghost.getBoundingClientRect() // 현재 모습을 한 번 그린 뒤 전환을 시작한다.
  ghost.style.transition = `opacity ${EXIT_MS}ms ease-in`
  ghost.style.opacity = '0'
  if (panel) {
    panel.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`
    panel.style.transform = 'translateY(100%)'
  }
  window.setTimeout(() => ghost.remove(), EXIT_MS + 60)
}

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

// `closeOnBack` 시트는 뒤로가기도 닫기 버튼과 같은 경로(onClose → 부모의 닫기 가드)로 처리하려고, 열려 있는 동안 history 항목을 하나씩 쌓는다.
// 작성 내용을 폐기 확인으로 지키는 시트용이다. 시트 동작이 화면 이동(navigate)으로 이어지는 시트는 항목이 이동 거리를 바꾸므로 쓰지 않는다.
// 항목이 없으면 뒤로가기가 시트가 아니라 화면 전체를 이탈시켜 폐기 확인 없이 작성 내용이 사라진다.
// 뒤로가기로 항목이 빠져도 시트가 계속 열려 있을 수 있어(저장 중·폐기 확인) 그때는 항목을 다시 쌓고 닫기만 요청한다.
const historyEntries = [] // 쌓은 순서대로 { id, live }. 끝이 history의 현재 위치다.
const entryOwners = new WeakMap() // 패널 요소 → 그 시트의 항목
let entrySeq = 0
let silentPops = 0 // 시트를 닫으며 우리가 되돌린 popstate. 닫기 요청으로 다시 해석하면 안 된다.

function pushEntry(entry) {
  entry.baseKey = window.history.state?.key
  window.history.pushState({ ...window.history.state, sheet: entry.id }, '') // react-router의 idx·key를 그대로 둬 앱 안 뒤로가기 판단이 변하지 않게 한다.
  historyEntries.push(entry)
}

function onHistoryPop() {
  if (silentPops > 0) { silentPops -= 1; return }
  const entry = entryOwners.get(sheets.at(-1))
  if (!entry || historyEntries.at(-1) !== entry) return
  // 시트 아래 화면으로 돌아온 경우만 뒤로가기로 본다. 다른 화면으로 이동했으면(키가 다름) 시트는 화면과 함께 사라진다.
  if (window.history.state?.key !== entry.baseKey) return
  window.history.pushState({ ...window.history.state, sheet: entry.id }, '')
  entry.close()
}

/** 닫힌 시트의 항목이 history 끝에 남아 있으면 되돌려 지운다. 화면 이동으로 이미 지나간 항목은 건드리지 않는다. */
function trimEntries() {
  // 끝 항목이 현재 위치일 때만, 그 아래로 이어진 닫힌 항목들도 연속해서 쌓여 있다고 보고 한 번에 되돌린다.
  const atTop = window.history.state?.sheet === historyEntries.at(-1)?.id
  let back = 0
  while (historyEntries.length > 0 && !historyEntries.at(-1).live) {
    if (atTop) back += 1
    historyEntries.pop()
  }
  if (back > 0) {
    silentPops += 1
    window.history.go(-back)
  }
}

export default function BottomSheet({ open, ...props }) {
  return open ? <OpenBottomSheet {...props} /> : null
}

function OpenBottomSheet({ onClose, title, eyebrow, compactTitle = false, closeOnBack = false, children }) {
  const [expanded, setExpanded] = useState(false)
  const panel = useRef(null)
  const backdrop = useRef(null)
  const drag = useRef(null)
  const dragged = useRef(false)
  const settleTimer = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => () => window.clearTimeout(settleTimer.current), [])
  // 사라질 때 아직 화면에 붙어 있는 시점에 모습을 복사해야 해서 레이아웃 효과로 둔다.
  useLayoutEffect(() => {
    const element = backdrop.current
    return () => playExitAnimation(element)
  }, [])

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
    const button = event.target.closest('button')
    if (button && button !== event.currentTarget) return // 제목 줄의 닫기 버튼 등은 끌기로 보지 않는다.
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

  /** 브라우저가 터치를 가져가 드래그가 끊기면 진행 중이던 끌기를 버리고 시트를 제자리로 돌린다. */
  function cancelDrag() {
    drag.current = null
    resetInline()
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
    else if (state.height - state.startHeight >= SNAP_DISTANCE) target = 'expanded'
    else if (state.startHeight - state.height >= SNAP_DISTANCE) target = 'collapsed'
    else target = state.startHeight - state.collapsedHeight > 1 ? 'expanded' : 'collapsed' // 조금만 끌었으면 시작했던 상태 그대로

    element.style.transition = '' // CSS의 전환이 다시 적용돼 목표 위치까지 부드럽게 붙는다.
    if (target === 'close') {
      // 시트가 사라지면 그 자리에서 아래로 내려가는 효과가 이어진다(playExitAnimation). 부모가 닫기를 거절하면 제자리로 되돌린다.
      close.current?.()
      settleTimer.current = window.setTimeout(resetInline, 80)
      return
    }
    const next = target === 'expanded'
    element.style.transform = ''
    element.style.height = `${next ? state.maxHeight : state.collapsedHeight}px`
    setExpanded(next)
    settleTimer.current = window.setTimeout(resetInline, SNAP_MS + 40)
  }

  useEffect(() => {
    if (!closeOnBack) return undefined
    const entry = { id: ++entrySeq, live: true, close: () => close.current?.() }
    entryOwners.set(panel.current, entry)
    window.addEventListener('popstate', onHistoryPop) // 같은 함수는 한 번만 등록된다. 시트를 닫으며 되돌린 popstate(silentPops)도 받아야 해서 떼지 않는다.
    // StrictMode(개발 환경)는 효과를 한 번 정리했다 다시 돌리므로, 한 틱 미뤄 항목이 두 번 쌓이지 않게 한다.
    const timer = window.setTimeout(() => pushEntry(entry), 0)
    return () => {
      window.clearTimeout(timer)
      entry.live = false
      // 같은 커밋에서 겹친 시트(폐기 확인 시트와 작성 시트)가 함께 닫힐 수 있어, 모두 정리된 뒤 한 번에 되돌린다.
      window.setTimeout(trimEntries, 0)
    }
  }, [closeOnBack])

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
      ref={backdrop}
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
          onPointerCancel={cancelDrag}
        >
          <span className="w-10 h-1 rounded-full bg-surface-container-highest" />
        </button>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {(title || onClose) && (
            <div
              className={`flex items-start justify-between touch-none ${compactTitle ? 'mb-1' : 'mb-space-md'}`}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
            >
              <div>
                {eyebrow && (
                  <div className="inline-flex items-center gap-space-xs mb-1">
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
