import { useCallback, useEffect, useState } from 'react'
import { detectInstallEnvironment } from './installGuide.js'

const DISMISS_KEY = 'cking.installPromptDismissed'

/** 현재 창이 이미 설치된 standalone 웹앱으로 실행 중인지 확인한다. */
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
    /** 브라우저가 설치 프롬프트를 준비했을 때 나중에 사용자 동작으로 실행하도록 저장한다. */
    function onBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    /** 설치가 끝난 뒤 설치 안내를 즉시 숨긴다. */
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

  const environment = typeof navigator === 'undefined' ? null : detectInstallEnvironment(navigator.userAgent)

  /** 브라우저가 제공한 설치 팝업을 사용자 요청으로 열고 선택 결과를 돌려준다. */
  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice?.outcome === 'accepted'
  }, [deferredPrompt])

  /** 사용자가 닫은 설치 안내를 현재 브라우저에 기억한다. */
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
    environment,
    standalone,
    visible: !standalone && !dismissed,
    install,
    dismiss,
  }
}
