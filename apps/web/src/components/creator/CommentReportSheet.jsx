import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
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
 * 게시글 상세 모달(z-60) 위에 떠야 해서 BottomSheet(z-40) 대신 따로 둔다.
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
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50 md:items-center md:justify-center"
      onClick={submitting ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="댓글 신고"
        className="mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col gap-space-md overflow-y-auto rounded-t-[28px] bg-surface-container-lowest p-space-md pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-2xl md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">댓글 신고</h2>
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
      </section>
    </div>
  )
}
