// 결과를 모르는 실패(네트워크 끊김·타임아웃·적립 장애·점검)는 서버가 이미 적립했을 수 있어 같은 requestId로 재시도해야 한다.
export const RETRY_WITH_SAME_ID = ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']

/**
 * 실패한 지급 요청의 requestId를 다음 재시도에 그대로 써야 하는지 판별한다. 서버가 적립을 승인했는지 알 수 없으면 유지한다.
 * 유지하는 경우(승인 불명):
 * - 응답 코드가 없다(null·undefined). ApiError가 아닌 예외, JSON이 아닌 502 같은 프록시 오류, 본문 파싱 실패가 여기에 든다.
 * - RETRY_WITH_SAME_ID에 든 코드.
 * - HTTP 5xx. 서버 내부 오류는 처리 도중이었을 수 있어 코드가 있어도 확정 실패로 보지 않는다.
 * - 성공(2xx) 응답인데 지급 승인 코드가 아니다. 계약 밖의 응답이라 승인 여부를 알 수 없다.
 * 버리는 경우(확정 실패): 오답·조건 미충족·이미 지급처럼 서버가 처리하지 않았다고 알려 준 4xx 응답. 이때는 새 requestId를 쓴다.
 */
export function keepsRequestId(error) {
  const code = error?.code
  if (code === null || code === undefined) return true
  if (RETRY_WITH_SAME_ID.includes(code)) return true
  const status = error?.status
  return typeof status === 'number' && (status >= 500 || (status >= 200 && status < 300))
}
