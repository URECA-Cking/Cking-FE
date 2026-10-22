import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { ApiError, describeError } from '../../api/client.js'
import {
  COMMENT_REPORT_DETAIL_MAX,
  COMMENT_REPORT_ERROR_MESSAGES,
  COMMENT_REPORT_REASONS,
  reportComment,
} from '../../api/posts.js'

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all resize-none'

function describeReportError(error) {
  if (error instanceof ApiError && COMMENT_REPORT_ERROR_MESSAGES[error.code]) return COMMENT_REPORT_ERROR_MESSAGES[error.code]
  return describeError(error, '신고하지 못했어요. 잠시 뒤에 다시 시도해주세요.')
}

/**
 * 댓글 신고 창(Cking-BE comment-api.md '댓글 신고').
 * 게시글 상세 위에 공통 바텀시트로 표시한다.
 * 신고는 댓글의 노출 상태를 바꾸지 않으므로 접수되면 안내만 하고 닫는다.
 *
 * @param {{ creatorId: number, postId: number, commentId: number,
 *   onClose: () => void, onReported: () => void, onGone: (error: ApiError) => void }} props
 *   onGone: 댓글이 삭제됐거나 볼 수 없게 된 경우(RESOURCE_NOT_FOUND, POST_FOLLOWERS_ONLY)라 신고할 수 없을 때 부른다.
 */
export default function CommentReportSheet({ creatorId, postId, commentId, onClose, onReported, onGone }) {
  const [reason, setReason] = useState(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const other = reason === 'OTHER'
  const trimmed = detail.trim()
  const canSubmit = reason !== null && (!other || trimmed.length > 0) && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await reportComment(creatorId, postId, commentId, { reason, detail: trimmed })
      onReported()
    } catch (reportError) {
      const code = reportError instanceof ApiError ? reportError.code : null
      if (code === 'RESOURCE_NOT_FOUND' || code === 'POST_FOLLOWERS_ONLY') {
        onGone(reportError)
        return
      }
      setError(describeReportError(reportError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open title="댓글 신고" onClose={submitting ? undefined : onClose}>
      <div className="flex flex-col gap-space-md">
        <fieldset className="flex flex-col gap-2" disabled={submitting}>
          <legend className="mb-1 font-body-sm text-body-sm text-on-surface-variant">신고 사유를 선택해주세요.</legend>
          {COMMENT_REPORT_REASONS.map((item) => (
            <label
              key={item.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 ${reason === item.value ? 'bg-surface-container-high' : 'bg-surface-container'}`}
            >
              <input
                type="radio"
                name="comment-report-reason"
                value={item.value}
                checked={reason === item.value}
                onChange={() => { setReason(item.value); setError('') }}
                className="accent-primary"
              />
              <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
            </label>
          ))}
        </fieldset>

        {other && (
          <div className="flex flex-col gap-1">
            <textarea
              value={detail}
              maxLength={COMMENT_REPORT_DETAIL_MAX}
              rows={3}
              aria-label="신고 내용"
              placeholder="신고하는 이유를 적어주세요."
              disabled={submitting}
              onChange={(event) => setDetail(event.target.value)}
              className={inputClass}
            />
            <span className="self-end font-label-xs text-label-xs text-outline">{detail.length}/{COMMENT_REPORT_DETAIL_MAX}</span>
          </div>
        )}

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
            {submitting ? '신고하는 중...' : '신고하기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
