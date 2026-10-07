import { useContext } from 'react'
import ToastContext from './toastContext.js'

export function useToast() {
  return useContext(ToastContext)
}
