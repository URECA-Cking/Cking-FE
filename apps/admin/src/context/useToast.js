import { useContext } from 'react'
import { ToastContext } from './toastContext.js'

/** Toast 공급자가 제공한 알림 함수를 반환한다. */
export function useToast() {
  return useContext(ToastContext)
}
