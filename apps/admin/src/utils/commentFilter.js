// 필터링된 댓글의 사유 표시 규칙(Cking-BE docs/domains/post/admin-filtered-comment-api.md, 이슈 #463).

const OTHER_REASON_LABEL = '기타'

/** 유형별 문구. 코드는 `유형` 또는 `유형:세부 항목` 형식이다. */
const REASON_TYPE_LABELS = {
  classifier: 'AI 판단',
  model: 'AI 판단',
  profanity: '욕설',
  privacy: '개인정보',
  spam: '스팸',
}

/** 세부 항목까지 풀어 쓸 수 있는 코드의 문구. */
const REASON_DETAIL_LABELS = {
  'privacy:phone': '전화번호',
  'privacy:email': '이메일',
  'privacy:address': '주소',
  'spam:link': '링크',
}

/** 모르는 세부 항목은 유형 문구로, 모르는 유형은 기타로 보여준다. */
export function filterReasonLabel(code) {
  return REASON_DETAIL_LABELS[code] ?? REASON_TYPE_LABELS[String(code).split(':')[0]] ?? OTHER_REASON_LABEL
}

/** 사유 목록을 "욕설 · 링크" 형태로 만든다. 같은 문구는 한 번만 보여주고, 비어 있으면 대시다. */
export function filterReasonSummary(reasons) {
  const labels = [...new Set((reasons ?? []).map(filterReasonLabel))]
  return labels.length === 0 ? '-' : labels.join(' · ')
}

/** 본문을 고쳐 재판정이 끝나지 않은 댓글인지. 이때 사유는 수정 전 내용의 판정이다. */
export function isFilterRecheckPending(filterStatus) {
  return filterStatus != null && filterStatus !== 'DONE'
}
