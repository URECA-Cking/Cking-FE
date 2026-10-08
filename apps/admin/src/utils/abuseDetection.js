export const ABUSE_TYPE_META = {
  MISSION_REQUEST_BURST: { label: '미션 요청 과다', tone: 'bg-amber-50 text-amber-800' },
  DUPLICATE_MISSION_BURST: { label: '중복 미션 반복', tone: 'bg-red-50 text-red-800' },
  ENTRY_REQUEST_BURST: { label: '응모 요청 과다', tone: 'bg-amber-50 text-amber-800' },
  INSUFFICIENT_BALANCE_BURST: { label: '잔액 부족 반복', tone: 'bg-orange-50 text-orange-800' },
  RAPID_EARN_AND_SPEND: { label: '빠른 적립·사용', tone: 'bg-violet-50 text-violet-800' },
  FAILURE_BURST: { label: '업무 실패 반복', tone: 'bg-red-50 text-red-800' },
}

export const ABUSE_STATUS_META = {
  DETECTED: { label: '검토 대기', tone: 'bg-amber-50 text-amber-800' },
  CONFIRMED: { label: '이상 행동 확인', tone: 'bg-red-50 text-red-800' },
  FALSE_POSITIVE: { label: '오탐 처리', tone: 'bg-emerald-50 text-emerald-800' },
}

const SCOPE_LABEL = {
  USER: '회원',
  BUSINESS_KEY: '미션 수행 단위',
  USER_EVENT: '회원·이벤트',
  USER_BALANCE_SCOPE: '회원·응모권 범위',
}

const METRIC_LABEL = {
  missionRequestCount: '미션 요청 수',
  duplicateMissionFailureCount: '중복 미션 실패 수',
  entryRequestCount: '응모 요청 수',
  insufficientBalanceFailureCount: '잔액 부족 실패 수',
  insufficientBalanceConsecutiveCount: '잔액 부족 연속 횟수',
  distinctRequestIdCountPerBusinessKey: '수행 단위별 요청 ID 수',
  rapidEarnSpendPairCount: '빠른 적립·사용 쌍 수',
  rapidEarnSpendPairCreated: '현재 빠른 적립·사용 발생',
  failureCount: '업무 실패 수',
  failureConsecutiveCount: '업무 실패 연속 횟수',
  distinctFailureTypeCount: '서로 다른 실패 유형 수',
}

export function abuseTypeLabel(type) {
  return ABUSE_TYPE_META[type]?.label ?? type ?? '-'
}

export function abuseStatusLabel(status) {
  return ABUSE_STATUS_META[status]?.label ?? status ?? '-'
}

export function scopeSummary(scope) {
  if (!scope) return '-'
  const values = [SCOPE_LABEL[scope.type] ?? scope.type]
  if (scope.creatorId != null) values.push(`Creator #${scope.creatorId}`)
  if (scope.eventId != null) values.push(`Event #${scope.eventId}`)
  if (scope.missionId != null) values.push(`Mission #${scope.missionId}`)
  if (scope.periodKey) values.push(scope.periodKey)
  if (scope.balanceScope) values.push(balanceScopeLabel(scope.balanceScope))
  return values.join(' · ')
}

export function balanceScopeLabel(balanceScope) {
  if (!balanceScope) return '-'
  return balanceScope.type === 'CREATOR'
    ? `Creator 응모권${balanceScope.creatorId != null ? ` #${balanceScope.creatorId}` : ''}`
    : '공용 응모권'
}

export function metricLabel(metric) {
  return METRIC_LABEL[metric] ?? metric
}

export function formatWindow(window) {
  return formatDuration(window?.windowMs)
}

export function formatMaxDelay(window) {
  return window?.maxDelayMs == null ? undefined : formatDuration(window.maxDelayMs)
}

export function ruleLabels(rules = []) {
  return rules.length > 0 ? rules.join(', ') : '-'
}

/** datetime-local 입력을 API의 UTC RFC 3339 query 값으로 변환한다. */
export function toUtcDateTime(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function formatDuration(milliseconds) {
  if (milliseconds == null) return '-'
  return milliseconds % 1000 === 0 ? `${milliseconds / 1000}초` : `${milliseconds}ms`
}
