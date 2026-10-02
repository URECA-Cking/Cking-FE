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

// 크리에이터 본인 일정 CRUD API. Creator 계정의 Access JWT가 필요하다.
// PATCH는 부분 수정이 아니라 전체 필드 교체다 — 필드 하나라도 빠지면 VALIDATION_FAILED.

/**
 * @typedef {Object} ScheduleFields
 * @property {'BIRTHDAY'|'FAN_SIGN'|'BROADCAST'|'CONTENT_RELEASE'|'OTHER'} scheduleType
 * @property {string} title
 * @property {string} [description]
 * @property {Date} startAt
 * @property {Date} endAt
 * @property {string} timeZone IANA 지역명(예: Asia/Seoul). 자유 입력 시 VALIDATION_FAILED 위험이 크다.
 * @property {string} [location]
 * @property {string} [imageUrl]
 * @property {string} [externalUrl]
 */

/** @param {ScheduleFields} fields */
function toScheduleRequestBody(fields) {
  return {
    scheduleType: fields.scheduleType,
    title: fields.title,
    description: fields.description || null,
    startAt: fields.startAt.toISOString(),
    endAt: fields.endAt.toISOString(),
    timeZone: fields.timeZone,
    location: fields.location || null,
    imageUrl: fields.imageUrl || null,
    externalUrl: fields.externalUrl || null,
  };
}

/** GET /api/creator/calendar/schedules - 내 일정 중 기간과 겹치는 것(조회 기간 365일 이하). */
export async function getMySchedules(from, to) {
  return apiClient.get('/api/creator/calendar/schedules', {
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

/** POST /api/creator/calendar/schedules - 관리자 승인 없이 생성 즉시 공개된다. */
export function createSchedule(fields) {
  return apiClient.post('/api/creator/calendar/schedules', toScheduleRequestBody(fields));
}

/** PATCH /api/creator/calendar/schedules/{scheduleId} - 전체 필드 교체(부분 수정 아님). */
export function updateSchedule(scheduleId, fields) {
  return apiClient.patch(`/api/creator/calendar/schedules/${scheduleId}`, toScheduleRequestBody(fields));
}

/** DELETE /api/creator/calendar/schedules/{scheduleId} - 하드 삭제, 되돌릴 수 없다. */
export function deleteSchedule(scheduleId) {
  return apiClient.delete(`/api/creator/calendar/schedules/${scheduleId}`);
}

/** 캘린더 CRUD 오류 코드별 사용자 문구. */
export const CALENDAR_ERROR_MESSAGES = {
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 시작 시각은 종료 시각보다 빨라야 하고, 수정 시 모든 필드를 채워야 해요.',
  FORBIDDEN: '크리에이터 계정만 일정을 등록할 수 있어요.',
  RESOURCE_NOT_FOUND: '일정을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
};
