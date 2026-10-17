// 관리자의 작성자 제재 화면 규칙(Cking-BE docs/domains/sanction/api.md, 이슈 Cking-FE #231).
// 신고된 댓글의 작성자를 "이 스페이스에서만"(스페이스 차단, POST /api/admin/comment-blocks) 또는 "모든 스페이스"
// (플랫폼 제한, POST /api/admin/sanctions)에서 댓글 작성·수정을 막는다. 허용 여부는 BE가 최종 판단하고, 이 파일은 화면에서 먼저 안내하는 용도다.
import { formatDateTime } from './format.js'
import {
  BLOCK_DAYS_MAX,
  BLOCK_DAYS_MIN,
  SPACE_BLOCK_ERROR_MESSAGES,
  ceilToMinute,
} from './spaceCommentBlock.js'

export const SANCTION_SCOPE = { SPACE: 'SPACE', PLATFORM: 'PLATFORM' }

/** 제재 범위 선택지. 첫 항목이 기본값이다(영향이 작은 범위부터 보여 준다). */
export const SANCTION_SCOPE_OPTIONS = [
  { value: SANCTION_SCOPE.SPACE, label: '이 스페이스에서만' },
  { value: SANCTION_SCOPE.PLATFORM, label: '모든 스페이스' },
]

export const REASON_MIN = 1
export const REASON_MAX = 200

/** 입력한 사유를 앞뒤 공백을 제거해 읽는다. 비었거나 200자를 넘으면 null. */
export function parseSanctionReason(text) {
  const trimmed = String(text ?? '').trim()
  return trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX ? trimmed : null
}

/** 모달에서 범위별로 보여 주는 설명. 어느 범위든 댓글 작성·수정만 막는다. */
export function sanctionDescription(scope, { creatorId, memberId }) {
  if (scope === SANCTION_SCOPE.PLATFORM) {
    return `회원 #${memberId}이(가) 모든 스페이스에서 댓글을 쓰거나 수정할 수 없게 해요. 이미 쓴 댓글은 그대로 남고 경고 횟수에는 세지 않아요. 해당 회원에게 알림이 가요. 이미 제한 중이어도 새 제한을 따로 기록하고, 종료 시각이 가장 늦은 쪽이 적용돼요.`
  }
  return `회원 #${memberId}이(가) 스페이스(Creator #${creatorId})에서 댓글을 쓰거나 수정할 수 없게 해요. 이미 쓴 댓글은 그대로 남고 다른 스페이스에서는 쓸 수 있어요. 새로 제재하면 해당 회원에게 알림이 가요. 이미 직접 건 제재가 있으면 기존 제재가 그대로 유지되고 새 알림은 가지 않아요(숨기기로 생긴 자동 제한은 해당하지 않아요).`
}

/**
 * 제재 범위별로 숨기기와의 관계를 알리는 문구. 숨기기는 작성자에게 경고를 쌓아 그 댓글이 달린 스페이스에서만 자동으로 제한을 건다(BE 이슈 #643).
 * 모든 스페이스에서 막는 제한은 관리자가 직접 거는 제재뿐이다.
 */
export function hideRelationNotice(scope) {
  if (scope === SANCTION_SCOPE.PLATFORM) {
    return '댓글을 숨기면 작성자에게 경고가 쌓여 그 스페이스에서만 1일·3일·7일 단계로 자동 제한이 걸려요. 모든 스페이스에서 막는 제한은 여기서 직접 거는 제재뿐이에요. 제한이 겹치면 종료 시각이 가장 늦은 쪽이 적용돼요.'
  }
  return '댓글을 숨기면 작성자에게 경고가 쌓여 그 스페이스에서만 1일·3일·7일 단계로 자동 제한이 걸려요. 자동 제한 중에도 여기서 직접 건 제재는 따로 기록되고, 제한이 겹치면 종료 시각이 가장 늦은 쪽이 적용돼요.'
}

/** 플랫폼 제한 탭의 `자동 경고` 행 설명. 이슈 #643 이전 정책으로 쌓인 기존 행이고, 지금의 숨기기는 스페이스 차단 탭에 자동 제한을 만든다. */
export const LEGACY_AUTOMATIC_NOTICE = '자동 경고 행은 숨기기가 모든 스페이스를 제한하던 이전 정책으로 쌓인 기존 제한이에요. 만료되거나 해제될 때까지 남고, 지금의 숨기기는 그 스페이스에서만 걸리는 자동 제한을 만들어 스페이스 차단 탭에 나와요.'

/**
 * 제재 실패 오류 코드별 문구. 모르는 코드는 null이라 호출하는 쪽이 일반 문구로 대신한다.
 * 스페이스 범위는 스페이스 차단 문구를 그대로 쓰고, 플랫폼 범위는 기간·사유 범위를 함께 알린다.
 */
export function sanctionErrorMessage(scope, code) {
  if (scope === SANCTION_SCOPE.PLATFORM) {
    if (code === 'VALIDATION_FAILED') {
      return `입력한 값을 확인해주세요. 기간은 ${BLOCK_DAYS_MIN}일 이상 ${BLOCK_DAYS_MAX}일 이하, 사유는 ${REASON_MIN}자 이상 ${REASON_MAX}자 이하입니다.`
    }
    if (code === 'RESOURCE_NOT_FOUND') return '대상 회원을 찾을 수 없어요.'
    if (code === 'CANNOT_BLOCK_ADMIN') return '관리자는 제재할 수 없어요.'
    if (code === 'CANNOT_SANCTION_CREATOR') return '크리에이터는 모든 스페이스 제재 대상이 아니에요. 해당 스페이스에서만 제재해주세요.'
    return null
  }
  return Object.hasOwn(SPACE_BLOCK_ERROR_MESSAGES, code) ? SPACE_BLOCK_ERROR_MESSAGES[code] : null
}

/** 제재 완료 안내. 이미 유효한 제재가 있으면 기존 제재가 돌아오므로 돌려받은 종료 시각 기준으로 알린다. */
export function sanctionSuccessMessage(scope, sanction) {
  const target = sanction?.memberName ?? `회원 #${sanction?.memberId}`
  const until = formatDateTime(ceilToMinute(new Date(sanction.endsAt)).toISOString())
  const where = scope === SANCTION_SCOPE.PLATFORM ? '모든 스페이스에서' : '이 스페이스에서'
  return `${target}을(를) ${until}까지 ${where} 제재했어요.`
}

/** 플랫폼 제한 한 건의 출처. AUTOMATIC은 관리자가 댓글을 숨겨 쌓인 경고, MANUAL은 관리자가 직접 건 제한이다. */
export const SANCTION_SOURCE_META = {
  AUTOMATIC: { label: '자동 경고', tone: 'bg-amber-50 text-amber-800' },
  MANUAL: { label: '관리자 제한', tone: 'bg-slate-100 text-slate-700' },
}

/** 출처 표시. 모르는 값은 코드를 그대로 보여 준다. */
export function sourceMeta(source) {
  return SANCTION_SOURCE_META[source] ?? { label: source ?? '-', tone: 'bg-slate-100 text-slate-700' }
}

/** 플랫폼 제한의 근거. 자동 경고는 숨긴 댓글 번호, 수동 제한은 입력한 사유다. */
export function sanctionBasis(sanction) {
  if (sanction?.source === 'AUTOMATIC') {
    return sanction.causeCommentId != null ? `숨긴 댓글 #${sanction.causeCommentId}` : '댓글 숨김'
  }
  return sanction?.reason ?? '-'
}

export const PLATFORM_STATUS_META = {
  ACTIVE: { label: '제한 중', tone: 'bg-red-50 text-red-800' },
  RELEASED: { label: '해제됨', tone: 'bg-slate-100 text-slate-700' },
  EXPIRED: { label: '기간 만료', tone: 'bg-slate-100 text-slate-700' },
}

/** 플랫폼 제한 해제 확인 창 문구. 자동 경고는 해제해도 경고 횟수에 남는다. */
export function platformReleaseConfirm(sanction) {
  const automatic = sanction?.source === 'AUTOMATIC'
  const warning = automatic ? ' 자동 경고는 해제해도 경고 횟수에는 남아요.' : ''
  return {
    title: '제한을 해제할까요?',
    message: `회원 #${sanction?.memberId}의 모든 스페이스 댓글 작성 제한을 지금 해제해요. 이 제한으로 막혀 있던 회원에게 해제 알림이 가요(다른 제한이 남아 있으면 알림은 가지 않아요).${warning}`,
    confirmLabel: '해제하기',
    confirmTone: 'bg-slate-700 hover:bg-slate-800',
  }
}
