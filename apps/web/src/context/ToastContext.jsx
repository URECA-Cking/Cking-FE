import { useCallback, useRef, useState } from 'react'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ToastContext from './toastContext.js'

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, opts = {}) => {
    clearTimeout(timerRef.current)
    setToast({ message, icon: opts.icon ?? 'check_circle' })
    timerRef.current = setTimeout(() => setToast(null), opts.duration ?? 2400)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        aria-live="polite"
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] max-w-[90%] px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 transition-all duration-300 ${
          toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {toast && (
          <>
            <MaterialIcon name={toast.icon} filled className="text-secondary-fixed text-[18px] shrink-0" />
            <span className="truncate">{toast.message}</span>
          </>
        )}
      </div>
    </ToastContext.Provider>
  )
}
