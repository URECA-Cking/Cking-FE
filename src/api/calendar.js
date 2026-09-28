import { apiClient } from './client';

// 크리에이터 캘린더 API(Cking-BE docs/domains/calendar/api.md).
// 캘린더 일정(CreatorSchedule)은 추첨 이벤트(Event)와 별개 개념이다. 응모·추첨은 이벤트 API를 쓴다.

/**
 * GET /api/creators/{creatorId}/calendar/schedules - 기간과 겹치는 일정(인증 불필요)
 * from·to는 ISO-8601 UTC Instant이고 조회 기간은 365일 이하다. startAt ASC로 정렬돼 온다.
 * @param {Date} from
 * @param {Date} to
 */
export async function getCreatorSchedules(creatorId, from, to) {
  return apiClient.get(`/api/creators/${creatorId}/calendar/schedules`, {
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

/** scheduleType별 표시 이름과 색(백엔드 enum: BIRTHDAY, FAN_SIGN, BROADCAST, CONTENT_RELEASE, OTHER). */
export const SCHEDULE_TYPE_META = {
  BIRTHDAY: { label: '생일', color: '#db2777' },
  FAN_SIGN: { label: '팬사인회', color: '#9d174d' },
  BROADCAST: { label: '방송', color: '#7c3aed' },
  CONTENT_RELEASE: { label: '콘텐츠 공개', color: '#835200' },
  OTHER: { label: '기타', color: '#594047' },
};

export function scheduleTypeMeta(type) {
  return SCHEDULE_TYPE_META[type] ?? SCHEDULE_TYPE_META.OTHER;
}
