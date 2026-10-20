import BottomSheet from './BottomSheet.jsx'

/**
 * 되돌릴 수 없는 동작(삭제 등)을 확인받는 바텀시트. 브라우저 기본 확인창(window.confirm)은
 * 인앱 브라우저나 "대화상자 더 이상 만들지 않음" 설정에서 막혀 동작하지 않을 수 있어 이 시트를 쓴다.
 * 처리 중(busy)에는 닫기와 중복 확인을 막는다.
 *
 * @param {{ open: boolean, title: string, message?: string, confirmLabel?: string, busy?: boolean,
 *   onConfirm: () => void, onClose: () => void }} props
 */
export default function ConfirmSheet({ open, title, message, confirmLabel = '삭제', busy = false, onConfirm, onClose }) {
  return (
    <BottomSheet open={open} onClose={busy ? undefined : onClose} title={title} compactTitle>
      {message && <p className="mb-space-md font-body-sm text-body-sm text-on-surface-variant">{message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-12 rounded-xl bg-surface-container font-label-md text-label-md font-semibold text-on-surface transition-all active:scale-[0.98] disabled:opacity-40"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="h-12 rounded-xl bg-error font-label-md text-label-md font-bold text-on-error transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? '처리하는 중...' : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
