import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
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
 * 스페이스에서 회원의 댓글 작성·수정을 일정 기간 막는 창(Cking-BE sanction/api.md '크리에이터 스페이스 댓글 차단 API'·'관리자 스페이스 댓글 차단 API').
 * 게시글 주인(크리에이터)과 관리자가 함께 쓰며, 호출할 API는 createBlock으로 받는다(관리자는 스페이스를 직접 지정해야 한다).
 * 게시글 상세 위에 공통 바텀시트로 표시한다. 차단해도 이미 쓴 댓글은 그대로 남는다.
 * 이미 유효한 차단이 있으면 서버가 새로 만들지 않고 기존 차단을 돌려주므로, 완료 뒤에는 돌려받은 차단의 종료 시각을 안내한다.
 *
 * @param {{ memberName: string | null, createBlock: (days: number) => Promise<object>,
 *   onClose: () => void, onBlocked: (block: object) => void }} props
 */
export default function CommentBlockSheet({ memberName, createBlock, onClose, onBlocked }) {
  const [daysText, setDaysText] = useState(String(BLOCK_DAYS_PRESETS[1]))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const days = parseBlockDays(daysText)
  const canSubmit = days !== null && !submitting
  const target = memberName || '이 회원'

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const block = await createBlock(days)
      onBlocked(block)
    } catch (blockError) {
      setError(commentBlockErrorMessage(blockError, '차단하지 못했어요. 잠시 뒤에 다시 시도해주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open title={`${target} 차단`} onClose={submitting ? undefined : onClose}>
      <div className="flex flex-col gap-space-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          정한 기간 동안 이 스페이스에서 댓글을 쓰거나 수정할 수 없어요. 이미 쓴 댓글은 그대로 남고, 다른 스페이스에서는 쓸 수 있어요.
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
      </div>
    </BottomSheet>
  )
}
