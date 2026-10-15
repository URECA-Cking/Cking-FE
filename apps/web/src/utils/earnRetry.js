// 결과를 모르는 실패(네트워크 끊김·타임아웃·적립 장애·점검)는 서버가 이미 적립했을 수 있어 같은 requestId로 재시도해야 한다.
export const RETRY_WITH_SAME_ID = ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']

/**
 * 실패한 지급 요청의 requestId를 다음 재시도에 그대로 써야 하는지 판별한다.
 * code가 null이면 ApiError가 아닌 예외라 서버 처리 여부를 알 수 없으므로 유지한다.
 * 오답·조건 미충족처럼 서버가 처리하지 않은 확정 실패는 false라서, 다시 시도할 때 새 requestId를 쓴다.
 */
export function keepsRequestId(code) {
  return code === null || RETRY_WITH_SAME_ID.includes(code)
}
