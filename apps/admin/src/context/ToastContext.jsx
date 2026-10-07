import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(() => {})
/** 관리자 작업 결과를 짧게 알리는 Toast 공급자다. */
export function ToastProvider({ children }) { const [toast, setToast] = useState(null); const showToast = useCallback((message, options = {}) => { setToast({ message, icon: options.icon }); window.setTimeout(() => setToast(null), 3000) }, []); return <ToastContext.Provider value={showToast}>{children}{toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-surface-container-high px-4 py-3 text-label-sm text-on-surface shadow-floating"><span>{toast.icon === 'error' ? '⚠ ' : ''}{toast.message}</span></div>}</ToastContext.Provider> }
/** Toast 공급자가 제공한 알림 함수를 반환한다. */
export function useToast() { return useContext(ToastContext) }
