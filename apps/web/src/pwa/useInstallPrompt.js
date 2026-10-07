import { useCallback, useEffect, useState } from 'react'

const DISMISS_KEY = 'cking.installPromptDismissed'

function alreadyStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
  )
}

/**
 * 웹앱 설치(홈 화면에 추가) 배너용 훅.
 * Chromium 계열은 beforeinstallprompt 이벤트를 가로채 직접 설치를 띄울 수 있고,
 * iOS Safari는 해당 이벤트가 없어 "공유 > 홈 화면에 추가" 안내만 노출한다.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [standalone, setStandalone] = useState(alreadyStandalone)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    function onInstalled() {
      setDeferredPrompt(null)
      setStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice?.outcome === 'accepted'
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 저장에 실패해도 이번 세션 동안은 숨겨진다.
    }
  }, [])

  return {
    canInstall: Boolean(deferredPrompt),
    needsIosGuide: isIos && !standalone,
    standalone,
    visible: !standalone && !dismissed && (Boolean(deferredPrompt) || (isIos && !standalone)),
    install,
    dismiss,
  }
}
