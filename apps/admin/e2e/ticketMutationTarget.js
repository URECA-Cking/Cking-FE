const SHARED_HOSTS = new Set(['dev-admin.cking.co.kr', 'dev-api.cking.co.kr', 'admin.cking.co.kr', 'api.cking.co.kr'])

/** 변경 테스트가 격리된 FE·API 주소를 명시하고 확인했는지 검증한다. */
export function resolveTicketMutationTarget({ adminBaseUrl, apiBaseUrl, isolatedConfirmed }) {
  if (isolatedConfirmed !== '1' || !adminBaseUrl || !apiBaseUrl) {
    throw new Error('변경 테스트에는 격리 환경 확인값과 FE·API 주소를 모두 명시해야 합니다.')
  }

  /** 한 주소가 경로 없는 격리 Origin인지 확인하고 정규화한다. */
  const parseOrigin = (value) => {
    let url
    try {
      url = new URL(value)
    } catch {
      throw new Error('변경 테스트의 FE·API 주소는 유효한 URL이어야 합니다.')
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!['http:', 'https:'].includes(url.protocol) || (!loopback && url.protocol !== 'https:')
      || url.pathname !== '/' || url.search || url.hash || url.username || url.password
      || SHARED_HOSTS.has(url.hostname)) {
      throw new Error('변경 테스트는 명시한 격리 FE·API Origin에서만 실행할 수 있습니다.')
    }
    return url.origin
  }

  return { adminOrigin: parseOrigin(adminBaseUrl), apiOrigin: parseOrigin(apiBaseUrl) }
}

/** 보정 POST가 지정한 격리 API Origin의 허용된 경로인지 확인한다. */
export function isAllowedTicketResyncRequest(requestUrl, apiOrigin) {
  const url = new URL(requestUrl)
  return url.origin === apiOrigin && [
    '/api/admin/tickets/resync',
    '/api/admin/tickets/common/resync',
  ].includes(url.pathname)
}
