import { useState } from 'react'

/** 승인·거절의 의도를 재확인하고, 필요할 때 거절 사유를 받는 공통 모달이다. */
export default function ConfirmModal({ action, subject, busy, onCancel, onConfirm, title, message, confirmLabel, confirmTone = 'bg-pink-700 hover:bg-pink-800', reasonLabel = '거절 사유', busyLabel }) {
  const rejecting = action === 'reject'
  const [reason, setReason] = useState('')

  function submit(event) {
    event.preventDefault()
    if (rejecting && !reason.trim()) return
    onConfirm(reason.trim())
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="review-confirm-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating">
        <h2 id="review-confirm-title" className="text-lg font-semibold text-slate-950">{title ?? (rejecting ? '심사 거절' : '승인 확인')}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{message ?? (rejecting ? `${subject}을(를) 거절할까요? 거절 사유는 신청자에게 전달될 수 있습니다.` : `${subject}을(를) 승인할까요? 승인 후 상태는 되돌릴 수 없습니다.`)}</p>
        {rejecting && <label className="mt-5 block text-sm font-medium text-slate-800">{reasonLabel} <span className="text-error">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} required rows="4" className="mt-2 block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 disabled:bg-slate-100" /></label>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="submit" disabled={busy || (rejecting && !reason.trim())} className={`h-9 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50 ${rejecting ? 'bg-error hover:bg-red-800' : confirmTone}`}>{busy ? (busyLabel ?? (rejecting ? '거절 처리 중...' : '처리 중...')) : (confirmLabel ?? (rejecting ? '거절하기' : '승인'))}</button>
        </div>
      </form>
    </div>
  )
}
