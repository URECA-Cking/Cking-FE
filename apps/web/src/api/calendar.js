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

/**
 * scheduleType별 표시 이름과 색(백엔드 enum: BIRTHDAY, FAN_SIGN, BROADCAST, CONTENT_RELEASE, OTHER).
 * 색은 화면 모드(다크/일반)마다 값이 달라 tailwind.config.js의 schedule-* 색 토큰을 쓴다:
 * textClass는 글씨색, bgClass는 배경색이다. Tailwind가 클래스를 만들 수 있게 이름을 통째로 적는다(조합 금지).
 */
export const SCHEDULE_TYPE_META = {
  BIRTHDAY: { label: '생일', textClass: 'text-schedule-birthday', bgClass: 'bg-schedule-birthday' },
  FAN_SIGN: { label: '팬사인회', textClass: 'text-schedule-fan-sign', bgClass: 'bg-schedule-fan-sign' },
  BROADCAST: { label: '방송', textClass: 'text-schedule-broadcast', bgClass: 'bg-schedule-broadcast' },
  CONTENT_RELEASE: {
    label: '콘텐츠 공개',
    textClass: 'text-schedule-content-release',
    bgClass: 'bg-schedule-content-release',
  },
  OTHER: { label: '기타', textClass: 'text-schedule-other', bgClass: 'bg-schedule-other' },
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

// 개인 캘린더 API(Cking-BE 이슈 #319). 사용자 본인의 Access JWT가 필요하다.
// CreatorSchedule을 참조만 하므로(내용 복사 없음) 크리에이터가 일정을 수정·삭제하면
// 이미 담은 사용자의 조회 결과에도 즉시 반영된다.

/** PUT /api/me/calendar/schedules/{scheduleId} - 담기. 이미 담겨 있어도 성공(멱등). */
export function addToMyCalendar(scheduleId) {
  return apiClient.put(`/api/me/calendar/schedules/${scheduleId}`);
}

/** DELETE /api/me/calendar/schedules/{scheduleId} - 제거. 담겨 있지 않아도 성공(멱등). */
export function removeFromMyCalendar(scheduleId) {
  return apiClient.delete(`/api/me/calendar/schedules/${scheduleId}`);
}

/** GET /api/me/calendar/schedules - 담은 일정 통합 조회. 각 항목에 creatorName이 포함된다(조회 기간 365일 이하). */
export async function getMyCalendar(from, to) {
  return apiClient.get('/api/me/calendar/schedules', {
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

/** 개인 캘린더 담기 오류 코드별 사용자 문구(제거는 멱등이라 오류 코드가 없다). */
export const MY_CALENDAR_ERROR_MESSAGES = {
  RESOURCE_NOT_FOUND: '크리에이터가 이미 삭제한 일정이에요.',
};

/** 캘린더 CRUD 오류 코드별 사용자 문구. */
export const CALENDAR_ERROR_MESSAGES = {
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 시작 시각은 종료 시각보다 빨라야 하고, 수정 시 모든 필드를 채워야 해요.',
  FORBIDDEN: '크리에이터 계정만 일정을 등록할 수 있어요.',
  RESOURCE_NOT_FOUND: '일정을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
};
