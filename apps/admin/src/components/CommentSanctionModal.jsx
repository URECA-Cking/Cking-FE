import { useEffect, useRef, useState } from 'react'
import { createPlatformSanction, createSpaceCommentBlock } from '../api/admin.js'
import { ApiError, describeError } from '../api/client.js'
import {
  BLOCK_DAYS_MAX,
  BLOCK_DAYS_MIN,
  BLOCK_DAYS_PRESETS,
  parseBlockDays,
} from '../utils/spaceCommentBlock.js'
import {
  HIDE_RELATION_NOTICE,
  REASON_MAX,
  SANCTION_SCOPE,
  SANCTION_SCOPE_OPTIONS,
  parseSanctionReason,
  sanctionDescription,
  sanctionErrorMessage,
} from '../utils/sanction.js'

function sanctionFailureMessage(scope, error) {
  const known = error instanceof ApiError ? sanctionErrorMessage(scope, error.code) : null
  return known ?? describeError(error, '제재하지 못했습니다. 잠시 뒤에 다시 시도해주세요.')
}

/**
 * 신고된 댓글의 작성자를 제재하는 모달. 범위를 고른다.
 * - 이 스페이스에서만: 그 스페이스에서 댓글 작성·수정을 일정 기간 막는다(BE POST /api/admin/comment-blocks).
 *   이미 유효한 차단이 있으면 새로 만들지 않고 기존 차단이 돌아온다.
 * - 모든 스페이스: 모든 스페이스에서 댓글 작성·수정을 일정 기간 막는다(BE POST /api/admin/sanctions). 사유가 필수이고
 *   경고 횟수에는 세지 않는다.
 * Esc로 닫고 열릴 때 대화상자로 포커스를 옮긴다. 요청을 보내는 중에는 닫지 않는다.
 *
 * @param {{ creatorId: number, memberId: number, onClose: () => void, onSanctioned: (result: { scope: string, sanction: object }) => void }} props
 */
export default function CommentSanctionModal({ creatorId, memberId, onClose, onSanctioned }) {
  const [scope, setScope] = useState(SANCTION_SCOPE.SPACE)
  const [daysText, setDaysText] = useState(String(BLOCK_DAYS_PRESETS[1]))
  const [reasonText, setReasonText] = useState('')
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

  const platform = scope === SANCTION_SCOPE.PLATFORM
  const days = parseBlockDays(daysText)
  const reason = parseSanctionReason(reasonText)
  const canSubmit = days !== null && (!platform || reason !== null)

  async function submit(event) {
    event.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    try {
      const sanction = platform
        ? await createPlatformSanction({ memberId, days, reason })
        : await createSpaceCommentBlock({ creatorId, memberId, days })
      onSanctioned({ scope, sanction })
    } catch (err) {
      setError(sanctionFailureMessage(scope, err))
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
        aria-labelledby="comment-sanction-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating outline-none"
      >
        <h2 id="comment-sanction-title" className="text-lg font-semibold text-slate-950">작성자 제재</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{sanctionDescription(scope, { creatorId, memberId })}</p>

        <fieldset className="mt-5" disabled={busy}>
          <legend className="text-sm font-medium text-slate-800">제재 범위</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SANCTION_SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={scope === option.value}
                onClick={() => { setScope(option.value); setError('') }}
                className={`h-8 rounded-md border px-3 text-sm font-medium ${scope === option.value ? 'border-pink-700 bg-pink-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5" disabled={busy}>
          <legend className="text-sm font-medium text-slate-800">제재 기간</legend>
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
              aria-label="제재 기간(일)"
              aria-invalid={days === null}
              onChange={(event) => { setDaysText(event.target.value); setError('') }}
              className="h-9 w-24 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"
            />
            일 ({BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX})
          </label>
          {days === null && <p className="mt-1 text-xs text-red-700" role="alert">{BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX} 사이의 정수로 입력해주세요.</p>}
        </fieldset>

        {platform && (
          <>
            <label className="mt-5 block text-sm font-medium text-slate-800">
              제재 사유 <span className="text-red-700">*</span>
              <textarea
                value={reasonText}
                onChange={(event) => { setReasonText(event.target.value); setError('') }}
                disabled={busy}
                rows="3"
                aria-invalid={reasonText.length > 0 && reason === null}
                placeholder="예: 반복 욕설"
                className="mt-2 block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 disabled:bg-slate-100"
              />
              <span className={`mt-1 block text-xs ${reasonText.trim().length > REASON_MAX ? 'text-red-700' : 'text-slate-500'}`}>
                {reasonText.trim().length}/{REASON_MAX}자 · 관리자 기록으로 남아요
              </span>
            </label>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="note">{HIDE_RELATION_NOTICE}</p>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="submit" disabled={busy || !canSubmit} className="h-9 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy ? '제재하는 중...' : '제재하기'}</button>
        </div>
      </form>
    </div>
  )
}
