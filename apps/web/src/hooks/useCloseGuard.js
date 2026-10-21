import { useCallback, useRef, useState } from 'react'

/** 가드가 돌려주는 값: 바로 닫는다. */
export const CLOSE_ALLOW = 'allow'
/** 가드가 돌려주는 값: 닫지 않는다(저장 중 등). */
export const CLOSE_BLOCK = 'block'
/** 가드가 돌려주는 값: 작성 내용이 사라지니 확인을 받은 뒤 닫는다. */
export const CLOSE_CONFIRM = 'confirm'

/**
 * 작성 시트를 닫을 때 "지금 닫아도 되는지"를 폼이 정하고, 작성 중인 내용이 있으면 확인 시트를 거치게 한다.
 * 폼은 `registerGuard`로 가드(CLOSE_ALLOW·CLOSE_BLOCK·CLOSE_CONFIRM 중 하나를 돌려주는 함수)를 등록하고,
 * 바깥 시트는 `requestClose`를 닫기 동작으로 쓰며 `confirmSheetProps`를 ConfirmSheet에 넘긴다.
 * 브라우저 확인창(window.confirm)은 인앱 브라우저에서 막힐 수 있어 확인 시트를 쓴다.
 *
 * @param {boolean} open 시트가 열려 있는지. 닫히면 남아 있던 확인 상태를 버린다.
 * @param {() => void} onClose 실제로 시트를 닫는 동작
 */
export function useCloseGuard(open, onClose) {
  const guard = useRef(() => CLOSE_ALLOW)
  const [confirming, setConfirming] = useState(false)

  // 시트가 바깥에서 먼저 닫힌 경우, 다시 열 때 확인 시트가 바로 뜨지 않게 렌더 중에 상태를 맞춘다.
  if (!open && confirming) setConfirming(false)

  /** 폼이 현재 상태에 맞는 가드를 등록한다. */
  const registerGuard = useCallback((next) => {
    guard.current = next
  }, [])

  /** 닫기 요청을 가드 결과에 따라 처리한다: 바로 닫거나, 막거나, 확인 시트를 연다. */
  const requestClose = () => {
    const decision = guard.current()
    if (decision === CLOSE_ALLOW) onClose()
    else if (decision === CLOSE_CONFIRM) setConfirming(true)
  }

  const confirmSheetProps = {
    open: open && confirming,
    title: '작성 중인 내용이 사라져요',
    message: '닫으면 작성한 내용이 저장되지 않아요.',
    confirmLabel: '버리고 닫기',
    closeOnBack: true, // 작성 시트와 같이 뒤로가기로도 취소(확인 시트만 닫기)할 수 있게 한다.
    /** 확인하면 가드를 거치지 않고 시트를 닫는다. */
    onConfirm: () => {
      setConfirming(false)
      onClose()
    },
    /** 취소하면 확인 시트만 닫고 작성 중이던 시트로 돌아간다. */
    onClose: () => setConfirming(false),
  }

  return { registerGuard, requestClose, confirmSheetProps }
}
