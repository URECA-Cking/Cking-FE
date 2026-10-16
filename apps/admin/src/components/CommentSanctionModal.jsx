import { useEffect, useRef, useState } from 'react'
import { createSpaceCommentBlock } from '../api/admin.js'
import { ApiError, describeError } from '../api/client.js'
import {
  BLOCK_DAYS_MAX,
  BLOCK_DAYS_MIN,
  BLOCK_DAYS_PRESETS,
  SPACE_BLOCK_ERROR_MESSAGES,
  parseBlockDays,
} from '../utils/spaceCommentBlock.js'

function blockErrorMessage(error) {
  if (error instanceof ApiError && Object.hasOwn(SPACE_BLOCK_ERROR_MESSAGES, error.code)) return SPACE_BLOCK_ERROR_MESSAGES[error.code]
  return describeError(error, '차단하지 못했습니다. 잠시 뒤에 다시 시도해주세요.')
}

/**
 * 한 스페이스에서 회원의 댓글 작성·수정을 일정 기간 막는 모달(BE POST /api/admin/comment-blocks).
 * 이미 유효한 차단이 있으면 새로 만들지 않고 기존 차단이 돌아오므로, 완료 뒤에는 돌려받은 차단으로 안내한다.
 * Esc로 닫고 열릴 때 대화상자로 포커스를 옮긴다. 차단을 보내는 중에는 닫지 않는다.
 *
 * @param {{ creatorId: number, memberId: number, onClose: () => void, onBlocked: (block: object) => void }} props
 */
export default function SpaceBlockModal({ creatorId, memberId, onClose, onBlocked }) {
  const [daysText, setDaysText] = useState(String(BLOCK_DAYS_PRESETS[1]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])
  useEffect(() => {
    if (busy) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const days = parseBlockDays(daysText)

  async function submit(event) {
    event.preventDefault()
    if (days === null || busy) return
    setBusy(true)
    setError('')
    try {
      onBlocked(await createSpaceCommentBlock({ creatorId, memberId, days }))
    } catch (err) {
      setError(blockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onClick={busy ? undefined : onClose}>
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-block-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating outline-none"
      >
        <h2 id="space-block-title" className="text-lg font-semibold text-slate-950">스페이스에서 댓글 차단</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          회원 #{memberId}이(가) 스페이스(Creator #{creatorId})에서 댓글을 쓰거나 수정할 수 없게 해요. 이미 쓴 댓글은 그대로 남고 다른 스페이스에서는 쓸 수 있어요.
          새로 차단하면 해당 회원에게 알림이 가요. 이미 차단 중이면 기존 차단이 그대로 유지되고 새 알림은 가지 않아요.
        </p>

        <fieldset className="mt-5" disabled={busy}>
          <legend className="text-sm font-medium text-slate-800">차단 기간</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {BLOCK_DAYS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={days === preset}
                onClick={() => { setDaysText(String(preset)); setError('') }}
                className={`h-8 rounded-md border px-3 text-sm font-medium ${days === preset ? 'border-pink-700 bg-pink-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              >
                {preset}일
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            직접 입력
            <input
              type="text"
              inputMode="numeric"
              value={daysText}
              aria-label="차단 기간(일)"
              aria-invalid={days === null}
              onChange={(event) => { setDaysText(event.target.value); setError('') }}
              className="h-9 w-24 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"
            />
            일 ({BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX})
          </label>
          {days === null && <p className="mt-1 text-xs text-red-700" role="alert">{BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX} 사이의 정수로 입력해주세요.</p>}
        </fieldset>

        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="submit" disabled={busy || days === null} className="h-9 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy ? '차단하는 중...' : '차단하기'}</button>
        </div>
      </form>
    </div>
  )
}
