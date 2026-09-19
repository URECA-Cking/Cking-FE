// 서비스 워커 등록. 개발 중에는 HMR과 충돌하지 않도록 등록하지 않고,
// 이미 등록된 워커가 있으면 해제해 이전 빌드가 캐시를 잡고 있는 상황을 막는다.
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 서비스 워커 등록에 실패해도 앱 자체는 정상 동작해야 하므로 조용히 넘어간다.
    })
  })
}
