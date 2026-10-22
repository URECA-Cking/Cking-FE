import { apiClient, requestEnvelope } from './client.js';
import { describeEntryResult, ENTRY_RESULT } from '../utils/entryResult.js';

export { describeEntryResult, ENTRY_RESULT };

/**
 * POST /api/events/{eventId}/entries - 이벤트 응모 신청
 * couponType(CREATOR | COMMON)은 이 요청이 쓸 응모권 종류를 정한다(이벤트가 정하지 않는다). 생략하면 BE는 CREATOR로 본다.
 *
 * 성공 코드가 반드시 "SUCCESS"만은 아니다(같은 requestId 재전송은 DUPLICATE_REPLAY로
 * 200을 돌려준다). 그래서 apiClient가 아닌 requestEnvelope를 직접 써서 envelope 전체를
 * 그대로 반환하고, 결과 코드 해석은 화면에서 ENTRY_RESULT로 처리한다.
 */
export async function applyEntry(eventId, { requestId, ticketCount, couponType = 'CREATOR' }) {
  return requestEnvelope(`/api/events/${eventId}/entries`, {
    method: 'POST',
    body: { requestId, ticketCount, couponType },
  });
}

/**
 * GET /api/events/{eventId}/entry-status - 실시간 응모 현황(참여자 수·누적 응모권·내가 쓴 응모권).
 * 폴링용 표시값이라 응모 가능 여부나 확정 근거로 쓰지 않는다. realtime이 true면 Redis 집계(응모 수락 기준)라
 * myTicketCount가 DB 기준 내 응모 내역(entries/me)보다 일시적으로 클 수 있다. false면 DB 집계다.
 * @returns {Promise<{ eventId: number, participantCount: number, totalTicketCount: number, myTicketCount: number, realtime: boolean }>}
 */
export function getEntryStatus(eventId) {
  return apiClient.get(`/api/events/${eventId}/entry-status`);
}
