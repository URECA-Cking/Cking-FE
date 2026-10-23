// 크리에이터의 스페이스 댓글 차단 화면용 순수 로직. 계약은 Cking-BE docs/domains/sanction/api.md.
// 순수 로직이라 Vite 환경 값을 읽는 api/client.js 대신 공유 ApiError만 쓴다(Node 테스트에서 불러올 수 있게).
import { ApiError } from '@cking/shared/api'
import { describeError } from '../api/errorMessages.js'

export const BLOCK_DAYS_MIN = 1
export const BLOCK_DAYS_MAX = 365
/** 자주 쓰는 기간. 그 밖의 값은 직접 입력한다. */
export const BLOCK_DAYS_PRESETS = [1, 7, 30, 90]

/** 입력한 기간 문자열을 1~365 정수로. 비었거나 정수가 아니거나 범위 밖이면 null. */
export function parseBlockDays(text) {
  const trimmed = String(text ?? '').trim()
  if (!/^\d+$/.test(trimmed)) return null
  const days = Number(trimmed)
  return days >= BLOCK_DAYS_MIN && days <= BLOCK_DAYS_MAX ? days : null
}

const BLOCK_ERROR_MESSAGES = {
  CANNOT_BLOCK_SELF: '자기 자신은 차단할 수 없어요.',
  CANNOT_BLOCK_ADMIN: '관리자는 차단할 수 없어요.',
  CANNOT_BLOCK_SPACE_OWNER: '스페이스 주인은 자기 스페이스에서 차단할 수 없어요.',
  VALIDATION_FAILED: `차단 기간은 ${BLOCK_DAYS_MIN}일 이상 ${BLOCK_DAYS_MAX}일 이하로 입력해주세요.`,
  FORBIDDEN: '크리에이터나 관리자 계정만 댓글 차단을 관리할 수 있어요.',
  RESOURCE_NOT_FOUND: '대상을 찾을 수 없어요. 이미 사라진 회원이거나 차단일 수 있어요.',
}

export function commentBlockErrorMessage(error, fallback) {
  if (error instanceof ApiError && Object.hasOwn(BLOCK_ERROR_MESSAGES, error.code)) return BLOCK_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

/** 차단 한 건의 상태. active는 서버가 응답 시점에 계산한 값이다. */
export function blockStatus(block) {
  if (block.active) return 'ACTIVE'
  return block.releasedAt ? 'RELEASED' : 'EXPIRED'
}

export const BLOCK_STATUS_LABELS = {
  ACTIVE: '차단 중',
  RELEASED: '해제됨',
  EXPIRED: '기간 만료',
}
