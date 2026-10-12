// 댓글 신고 관리 화면의 표시·조치 규칙(Cking-BE docs/domains/post/comment-api.md, 이슈 #485·#499).
// 처리 상태·허용 조치는 BE가 최종 판단하고, 이 파일은 화면에서 먼저 안내하는 용도다.

/** 댓글 단위 처리 상태. 접수 신고가 남았으면 PENDING, 모두 처리됐으면 숨김 여부로 RESOLVED(숨김)·REJECTED(반려)다. */
export const REPORT_STATUS_META = {
  PENDING: { label: '접수', tone: 'bg-amber-50 text-amber-800' },
  RESOLVED: { label: '숨김 처리', tone: 'bg-red-50 text-red-800' },
  REJECTED: { label: '반려', tone: 'bg-slate-100 text-slate-700' },
}

/** 신고 사유 표시 순서와 문구. BE 사유 코드(ABUSE·SPAM·PRIVACY·OTHER)와 같다. */
export const REPORT_REASON_LABELS = {
  ABUSE: '욕설·혐오',
  SPAM: '스팸·홍보',
  PRIVACY: '개인정보 노출',
  OTHER: '기타',
}

export function reportStatusLabel(status) {
  return REPORT_STATUS_META[status]?.label ?? status ?? '-'
}

/** 모르는 사유 코드는 코드 그대로 보여준다. */
export function reasonLabel(code) {
  return REPORT_REASON_LABELS[code] ?? code
}

/**
 * 사유별 신고 수를 "욕설·혐오 2 · 스팸·홍보 1" 형태로 만든다. 아는 사유를 정해진 순서로 먼저, 모르는 사유는 코드순으로 뒤에 둔다.
 * 건수가 없는 사유는 건너뛴다.
 */
export function reasonSummary(reasonCounts) {
  const entries = Object.entries(reasonCounts ?? {}).filter(([, count]) => Number(count) > 0)
  if (entries.length === 0) return '-'
  const known = Object.keys(REPORT_REASON_LABELS)
  const rank = (code) => (known.includes(code) ? known.indexOf(code) : known.length)
  return entries
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([code, count]) => `${reasonLabel(code)} ${count}`)
    .join(' · ')
}

/**
 * 조치(숨김·반려)할 수 있는 댓글인지. 접수 신고가 남아 있을 때만 가능하다.
 * 이미 숨긴 댓글(반려 불가)과 접수 신고가 모두 반려된 댓글(숨김 불가)은 BE가 409로 막고, 접수 신고가 없는 경우를 한 번에 막는다.
 */
export function canHandle(item) {
  return Number(item?.pendingReportCount) > 0
}

/** 조치별 확인 창 문구. pendingCount는 이번 조치로 처리될 접수 신고 수다. */
export function actionConfirm(action, pendingCount) {
  if (action === 'hide') {
    return {
      title: '댓글을 숨길까요?',
      message: `숨긴 댓글은 다른 사용자에게 가려지고 원문 보기도 막혀요. 접수된 신고 ${pendingCount}건이 처리 완료로 바뀌고, 이 작업은 되돌릴 수 없어요.`,
      confirmLabel: '숨기기',
      confirmTone: 'bg-red-700 hover:bg-red-800',
    }
  }
  return {
    title: '신고를 반려할까요?',
    message: `댓글은 그대로 보여요. 접수된 신고 ${pendingCount}건이 반려로 처리돼요.`,
    confirmLabel: '반려하기',
    confirmTone: 'bg-slate-700 hover:bg-slate-800',
  }
}

/** 조치 성공 안내. handledReportCount가 0이면 같은 조치를 다시 요청해 바뀐 것이 없는 경우(멱등)다. */
export function actionSuccessMessage(action, handledReportCount) {
  if (action === 'hide') {
    return handledReportCount > 0 ? `신고 ${handledReportCount}건을 처리하고 댓글을 숨겼어요.` : '이미 숨긴 댓글이에요.'
  }
  return handledReportCount > 0 ? `신고 ${handledReportCount}건을 반려했어요.` : '이미 반려한 신고예요.'
}

/**
 * 조치 뒤 다시 읽은 목록이 비었을 때 보여줄 화면 위치(탭·페이지). 읽은 결과가 비었고 이전 페이지가 있으며, 조회를 시작한 탭·페이지에
 * 아직 머물러 있을 때만 한 페이지 줄인다. 재조회 중에 탭이나 페이지를 바꿨다면 그 결과는 지금 화면과 무관하므로 그대로 둔다
 * (페이지가 0 아래로 내려가면 API가 400을 돌려준다).
 *
 * @param {{ status: string, page: number }} started 재조회를 시작할 때의 화면 위치
 * @param {{ status: string, page: number }} current 재조회가 끝난 지금의 화면 위치
 * @param {number} refreshedCount 다시 읽은 목록의 항목 수
 */
export function viewAfterRefresh(started, current, refreshedCount) {
  if (refreshedCount > 0 || started.page <= 0) return current
  if (current.status !== started.status || current.page !== started.page) return current
  return { ...current, page: current.page - 1 }
}

/** 조치 실패 오류 코드별 문구. 이 코드들은 최신 상태를 다시 읽어 확인해야 한다. */
export const COMMENT_REPORT_ERROR_MESSAGES = {
  COMMENT_REPORT_ALREADY_HANDLED: '이미 다른 조치로 처리된 신고예요. 최신 상태를 확인해주세요.',
  RESOURCE_NOT_FOUND: '댓글이 삭제됐거나 신고를 찾을 수 없어요. 목록을 새로 불러올게요.',
}
