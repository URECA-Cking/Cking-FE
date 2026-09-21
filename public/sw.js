/* Cking 웹앱 서비스 워커.
 * - 앱 셸(정적 자산): stale-while-revalidate 로 즉시 띄우고 백그라운드에서 갱신한다.
 * - API(/api/*): 항상 네트워크 우선. 응모/잔액처럼 값이 바로 바뀌는 데이터라 캐시를 신뢰할 수 없다.
 *   네트워크가 끊겼을 때만 마지막으로 성공한 GET 응답을 돌려준다.
 * - 네비게이션: 네트워크 우선, 실패하면 캐시된 app shell(SPA 진입점)로 폴백한다.
 */
const VERSION = 'v1'
const SHELL_CACHE = `cking-shell-${VERSION}`
const API_CACHE = `cking-api-${VERSION}`
const SHELL_URL = '/index.html'
const PRECACHE = ['/', SHELL_URL, '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== API_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ code: 'OFFLINE', message: '오프라인 상태예요. 네트워크 연결을 확인해주세요.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

async function navigationFallback(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    return (await cache.match(SHELL_URL)) || (await cache.match('/')) || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})
