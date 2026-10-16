// 관리자의 댓글 삭제·스페이스 댓글 차단 화면의 표시·입력 규칙(Cking-BE docs/domains/sanction/api.md '관리자 스페이스 댓글 차단 API',
// docs/domains/post/comment-api.md 'DELETE /api/admin/comments/{commentId}', 이슈 #584).
// 허용 여부는 BE가 최종 판단하고, 이 파일은 화면에서 먼저 안내하는 용도다.

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

/**
 * 목록 필터의 ID 입력(creatorId·memberId)을 읽는다. 비어 있으면 필터 없음(undefined),
 * 양의 정수면 그 수, 그 밖의 값(0·음수·소수·문자)은 잘못된 입력(null)이다.
 */
export function parseFilterId(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return undefined
  if (!/^\d+$/.test(trimmed)) return null
  const id = Number(trimmed)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** 초 이하가 있으면 다음 분으로 올린다. 표시한 종료 시각 이후에는 항상 차단이 풀려 있게 하려는 것이다. */
export function ceilToMinute(date) {
  return new Date(Math.ceil(date.getTime() / 60000) * 60000)
}

/** 차단 한 건의 상태. active는 서버가 응답 시점에 계산한 값이다. */
export function blockStatus(block) {
  if (block?.active) return 'ACTIVE'
  return block?.releasedAt ? 'RELEASED' : 'EXPIRED'
}

export const BLOCK_STATUS_META = {
  ACTIVE: { label: '차단 중', tone: 'bg-red-50 text-red-800' },
  RELEASED: { label: '해제됨', tone: 'bg-slate-100 text-slate-700' },
  EXPIRED: { label: '기간 만료', tone: 'bg-slate-100 text-slate-700' },
}

/**
 * 차단을 건 사람 표기. BE는 건 회원의 ID(createdBy)만 주고 크리에이터 본인인지 관리자인지는 알리지 않는다.
 * 크리에이터는 creatorId와 회원 ID가 달라 화면에서 대조할 수 없으므로, 지금 로그인한 관리자 본인이 건 것만 가려내고
 * 나머지는 회원 ID로 보여준다(크리에이터 본인이나 다른 관리자일 수 있다).
 */
export function createdByLabel(createdBy, myMemberId) {
  if (createdBy == null) return '-'
  return myMemberId != null && Number(createdBy) === Number(myMemberId) ? '나(관리자)' : `회원 #${createdBy}`
}

/** 차단 목록을 해제한 뒤 다시 읽은 결과가 비었을 때 가야 할 페이지. 이전 페이지가 있고 같은 페이지에 머물러 있을 때만 줄인다. */
export function pageAfterRefresh(startedPage, currentPage, refreshedCount) {
  if (refreshedCount > 0 || startedPage <= 0) return currentPage
  return currentPage === startedPage ? currentPage - 1 : currentPage
}

/** 스페이스 차단·댓글 삭제 실패 오류 코드별 문구. */
export const SPACE_BLOCK_ERROR_MESSAGES = {
  CANNOT_BLOCK_SELF: '관리자 본인은 차단할 수 없어요.',
  CANNOT_BLOCK_ADMIN: '관리자는 차단할 수 없어요.',
  CANNOT_BLOCK_SPACE_OWNER: '스페이스 주인은 자기 스페이스에서 차단할 수 없어요.',
  VALIDATION_FAILED: `입력한 값을 확인해주세요. 차단 기간은 ${BLOCK_DAYS_MIN}일 이상 ${BLOCK_DAYS_MAX}일 이하입니다.`,
  RESOURCE_NOT_FOUND: '대상을 찾을 수 없어요. 이미 삭제됐거나 없는 회원·크리에이터·차단일 수 있어요.',
}

/**
 * 이 코드를 받으면 화면의 목록이 서버와 어긋나 있을 수 있어 확인 창을 닫고 다시 읽는다.
 * 입력 오류나 권한 오류는 다시 읽어도 달라지지 않으므로 제외한다.
 */
export function shouldRefreshAfterError(code) {
  return code === 'RESOURCE_NOT_FOUND'
}

/** 댓글 삭제 확인 창 문구. 삭제는 되돌릴 수 없고 신고도 함께 지워지며 작성자 경고·알림·이력이 남지 않는다. */
export function deleteConfirm(item) {
  const reports = Number(item?.reportCount) > 0 ? ` 이 댓글의 신고 ${item.reportCount}건도 함께 삭제돼요.` : ''
  return {
    title: '댓글을 삭제할까요?',
    message: `삭제하면 되돌릴 수 없어요.${reports} 작성자에게 경고가 쌓이지 않고 알림도 가지 않으며, 삭제 기록도 남지 않아요. 경고를 남기려면 삭제 대신 "숨기기"를 사용하세요.`,
    confirmLabel: '삭제하기',
    confirmTone: 'bg-red-700 hover:bg-red-800',
  }
}

/** 스페이스 차단 해제 확인 창 문구. */
export function releaseConfirm(block) {
  return {
    title: '차단을 해제할까요?',
    message: `${block?.memberName ?? `회원 #${block?.memberId}`}의 스페이스 #${block?.creatorId} 차단을 지금 해제해요. 차단 중인 회원에게 해제 알림이 가요(이미 끝난 차단이면 알림은 가지 않아요).`,
    confirmLabel: '해제하기',
    confirmTone: 'bg-slate-700 hover:bg-slate-800',
  }
}
