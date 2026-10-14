import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'

/**
 * 댓글 머리글 오른쪽의 "..." 메뉴. 지금은 크리에이터의 작성자 차단 하나만 담는다.
 * 바깥을 누르거나 Esc를 누르면 닫힌다.
 *
 * @param {{ onBlock: () => void }} props
 */
export default function CommentMoreMenu({ onBlock }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        aria-label="댓글 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
      >
        <MaterialIcon name="more_horiz" className="text-[20px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-xl bg-surface-container-lowest shadow-card">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onBlock() }}
            className="block w-full px-3 py-2.5 text-left font-label-md text-label-md text-error hover:bg-surface-container"
          >
            이 회원 차단
          </button>
        </div>
      )}
    </div>
  )
}
