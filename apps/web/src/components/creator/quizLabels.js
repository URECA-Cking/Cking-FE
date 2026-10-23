// 내 Quiz 목록과 검토 시트가 함께 쓰는 상태 표시.

export const PUBLICATION_LABELS = {
  NOT_PUBLISHED: { label: '미게시', icon: 'visibility_off', tone: 'bg-surface-container text-on-surface-variant' },
  PUBLISHED: { label: '게시 중', icon: 'public', tone: 'bg-primary text-on-primary' },
  CLOSED: { label: '마감', icon: 'event_busy', tone: 'bg-surface-container-high text-on-surface-variant' },
  UNPUBLISHED: { label: '게시 중지', icon: 'pause_circle', tone: 'bg-surface-container-high text-on-surface' },
}

// 승인 화면의 원문 검토 결과. revision 상세의 contentEdited가 true·false일 때만 보여 주고, null(원문 검토 없이 만든 Quiz)이면
// 보여 주지 않는다.
export const CONTENT_REVIEW_LABELS = {
  true: { label: 'Creator가 수정한 원문', icon: 'edit_note', tone: 'bg-primary/10 text-primary' },
  false: { label: 'AI 원문 그대로 확정', icon: 'task_alt', tone: 'bg-surface-container-high text-on-surface' },
}

// 문항마다 평가하는 7개 항목(judge-api.md). 응답의 항목 키는 화면에 그대로 쓰지 않는다.
export const JUDGE_ITEMS = [
  ['textAnswerCorrect', '정답이 원문과 일치'],
  ['uniqueAnswer', '정답이 하나'],
  ['evidenceSupportsAnswer', '근거가 정답을 뒷받침'],
  ['questionClarity', '질문이 명확'],
  ['koreanQuality', '한국어 품질'],
  ['distractorQuality', '오답 보기 품질'],
  ['textFaithfulness', '원문 밖 내용 없음'],
]

export const VERDICTS = {
  pass: { label: '통과', icon: 'check_circle', className: 'text-primary' },
  fail: { label: '미통과', icon: 'cancel', className: 'text-error' },
  uncertain: { label: '보류', icon: 'help', className: 'text-on-surface-variant' },
}

/** 평가 항목 키를 화면 문구로 바꾼다. 모르는 키는 원문 대신 일반 문구를 쓴다. */
export function judgeItemLabel(key) {
  return JUDGE_ITEMS.find(([field]) => field === key)?.[1] ?? '평가 항목'
}

/** 판정 값을 화면 문구로 바꾼다. 모르는 값은 보류로 보여 준다. */
export function verdictLabel(verdict) {
  return (Object.hasOwn(VERDICTS, verdict ?? '') ? VERDICTS[verdict] : VERDICTS.uncertain).label
}

export const REVIEW_LABELS = {
  PENDING_REVIEW: { label: '검토 대기', icon: 'rate_review', tone: 'bg-surface-container-high text-on-surface' },
  APPROVED: { label: '승인됨', icon: 'verified', tone: 'bg-primary/10 text-primary' },
  REJECTED: { label: '반려됨', icon: 'block', tone: 'bg-error-container text-on-error-container' },
}
