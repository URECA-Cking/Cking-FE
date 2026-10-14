/**
 * 응모 처리 결과 코드별 사용자 문구.
 * 백엔드 EntryResultCode(10종) / EntryErrorCode와 1:1로 맞춘다.
 */
export const ENTRY_RESULT = {
  SUCCESS: { tone: 'success', message: '응모가 정상 완료되었습니다!' },
  DUPLICATE_REPLAY: { tone: 'success', message: '이미 접수된 응모예요. 중복으로 차감되지 않았습니다.' },
  EVENT_NOT_OPEN: { tone: 'error', message: '아직 응모가 열리지 않은 이벤트예요.' },
  EVENT_CLOSED: { tone: 'error', message: '응모가 마감된 이벤트예요.' },
  INSUFFICIENT_BALANCE: { tone: 'error', message: '보유한 응모권이 부족해요.' },
  INVALID_TICKET_COUNT: { tone: 'error', message: '응모 수량이 올바르지 않아요.' },
  IDEMPOTENCY_CONFLICT: { tone: 'error', message: '같은 요청번호로 다른 내용이 전달됐어요. 다시 시도해주세요.' },
  GATE_NOT_LOADED: { tone: 'retry', message: '응모 처리 준비 중이에요. 잠시 후 다시 시도해주세요.' },
  BALANCE_NOT_LOADED: { tone: 'retry', message: '잔액 정보를 준비하고 있어요. 잠시 후 다시 시도해주세요.' },
  SYSTEM_ERROR: { tone: 'error', message: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
  VALIDATION_FAILED: { tone: 'error', message: '요청 값이 올바르지 않아요.' },
  NETWORK_ERROR: { tone: 'error', message: '백엔드 서버에 연결할 수 없어요.' },
}

/** 응답 envelope 또는 전송 예외를 화면에서 쓸 수 있는 {code, accepted, tone, message}로 정리한다. */
export function describeEntryResult(result) {
  const code = result?.code ?? (result?.ok ? 'SUCCESS' : 'SYSTEM_ERROR')
  const known = ENTRY_RESULT[code]
  const accepted = code === 'SUCCESS' || code === 'DUPLICATE_REPLAY'
  return {
    code,
    accepted,
    tone: known?.tone ?? (accepted ? 'success' : 'error'),
    message: known?.message ?? result?.message ?? '응모 결과를 확인하지 못했어요.',
  }
}
