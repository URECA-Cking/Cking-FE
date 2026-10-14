import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { createCommentBlock } from '../../api/creatorCommentBlocks.js'
import {
  BLOCK_DAYS_MAX,
  BLOCK_DAYS_MIN,
  BLOCK_DAYS_PRESETS,
  commentBlockErrorMessage,
  parseBlockDays,
} from '../../utils/commentBlocks.js'

const inputClass =
  'w-24 px-3 py-2 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'

/**
 * 내 스페이스에서 회원의 댓글 작성·수정을 일정 기간 막는 창(Cking-BE sanction/api.md '크리에이터 스페이스 댓글 차단 API').
 * 게시글 상세 모달(z-60) 위에 떠야 해서 신고 창처럼 따로 둔다. 차단해도 이미 쓴 댓글은 그대로 남는다.
 * 이미 유효한 차단이 있으면 서버가 새로 만들지 않고 기존 차단을 돌려주므로, 완료 뒤에는 돌려받은 차단의 종료 시각을 안내한다.
 *
 * @param {{ memberId: number, memberName: string | null, onClose: () => void, onBlocked: (block: object) => void }} props
 */
export default function CommentBlockSheet({ memberId, memberName, onClose, onBlocked }) {
  const [daysText, setDaysText] = useState(String(BLOCK_DAYS_PRESETS[1]))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  // 열리면 대화상자로 포커스를 옮기고(스크린리더가 안내), Esc로 닫는다. 차단을 보내는 중에는 닫지 않는다.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])
  useEffect(() => {
    if (submitting) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [submitting, onClose])

  const days = parseBlockDays(daysText)
  const canSubmit = days !== null && !submitting
  const target = memberName || '이 회원'

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const block = await createCommentBlock({ memberId, days })
      onBlocked(block)
    } catch (blockError) {
      setError(commentBlockErrorMessage(blockError, '차단하지 못했어요. 잠시 뒤에 다시 시도해주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50 md:items-center md:justify-center"
      onClick={submitting ? undefined : onClose}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="댓글 차단"
        className="mx-auto flex outline-none max-h-[85dvh] w-full max-w-[480px] flex-col gap-space-md overflow-y-auto rounded-t-[28px] bg-surface-container-lowest p-space-md pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-2xl md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">{target} 차단</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant disabled:opacity-50"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant">
          정한 기간 동안 내 스페이스에서 댓글을 쓰거나 수정할 수 없어요. 이미 쓴 댓글은 그대로 남고, 다른 스페이스에서는 쓸 수 있어요.
          이미 차단 중이면 기존 차단이 유지돼요.
        </p>

        <fieldset className="flex flex-col gap-2" disabled={submitting}>
          <legend className="mb-1 font-label-md text-label-md text-on-surface">차단 기간</legend>
          <div className="flex flex-wrap gap-2">
            {BLOCK_DAYS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={days === preset}
                onClick={() => { setDaysText(String(preset)); setError('') }}
                className={`rounded-full px-3 py-1.5 font-label-sm text-label-sm ${days === preset ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container text-on-surface'}`}
              >
                {preset}일
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant">직접 입력</span>
            <input
              type="text"
              inputMode="numeric"
              value={daysText}
              aria-label="차단 기간(일)"
              aria-invalid={days === null}
              onChange={(event) => { setDaysText(event.target.value); setError('') }}
              className={inputClass}
            />
            <span className="font-label-sm text-label-sm text-on-surface-variant">일 ({BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX})</span>
          </label>
          {days === null && (
            <p className="font-label-xs text-label-xs text-error" role="alert">
              {BLOCK_DAYS_MIN}~{BLOCK_DAYS_MAX} 사이의 정수로 입력해주세요.
            </p>
          )}
        </fieldset>

        {error && <p className="font-label-xs text-label-xs text-error" role="alert">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl bg-surface-container px-4 py-2.5 font-label-md text-label-md text-on-surface disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-xl bg-error px-4 py-2.5 font-label-md text-label-md font-semibold text-on-error disabled:opacity-60"
          >
            {submitting ? '차단하는 중...' : '차단하기'}
          </button>
        </div>
      </section>
    </div>
  )
}
