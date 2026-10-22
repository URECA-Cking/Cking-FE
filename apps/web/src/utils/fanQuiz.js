// Fan Quiz 목록 페이지와 응시 제출 재시도 판단. 화면 상태와 분리해 단위 테스트한다.

export const QUIZ_PAGE_SIZE = 20

/**
 * 첫 페이지(first)와 "더 보기"로 이어 읽은 페이지(more)를 합친 목록. more는 같은 첫 페이지 응답(base)에서 이어
 * 읽은 것만 쓴다. 첫 페이지를 다시 읽었거나 다른 Creator로 바뀌면 이전 more는 버린다.
 */
export function quizListView(first, more) {
  if (!first) return { items: [], hasNext: false, nextPage: 0 }
  const extra = more && more.base === first ? more : null
  const seen = new Set()
  // 페이지 사이에 새 Quiz가 게시되면 같은 Quiz가 두 페이지에 걸칠 수 있어 quizId로 한 번만 보여준다.
  const items = [...(first.items ?? []), ...(extra?.items ?? [])].filter((quiz) => {
    if (seen.has(quiz.quizId)) return false
    seen.add(quiz.quizId)
    return true
  })
  return {
    items,
    hasNext: extra ? extra.hasNext : Boolean(first.hasNext),
    nextPage: extra ? extra.page + 1 : (first.page ?? 0) + 1,
  }
}

/** 다음 페이지 응답을 이어 붙인 more. 요청을 보낸 뒤 첫 페이지가 바뀌었으면(base 불일치) 응답을 버린다. */
export function appendQuizPage(more, base, currentFirst, page, response) {
  if (base !== currentFirst) return more
  const previous = more && more.base === base ? more.items : []
  return { base, items: [...previous, ...(response?.items ?? [])], page, hasNext: Boolean(response?.hasNext) }
}

/**
 * 이번 제출에 쓸 요청. 같은 답안이면 직전 요청의 requestId를 그대로 쓰고(응답을 받지 못한 재시도는 같은 요청으로
 * 보내야 BE가 저장된 결과를 돌려준다), 답안이 바뀌었으면 새 requestId를 만든다.
 */
export function submitRequestFor(pending, answers, newRequestId) {
  const key = JSON.stringify(answers)
  if (pending?.key === key) return pending
  return { key, requestId: newRequestId() }
}

/**
 * 제출 오류의 처리 방식.
 * - ALREADY_ATTEMPTED: 이미 저장된 응시가 있다(409 응시 중복·요청 충돌). 저장된 결과를 다시 조회한다.
 * - REVISION_CHANGED / NOT_FOUND: 서버가 명확히 거절했다.
 * - UNCERTAIN: 응답을 받지 못했거나(NETWORK_ERROR 등) 서버 오류(5xx)라 저장 여부를 알 수 없다. 같은 답안의 재시도에
 *   같은 requestId를 쓰도록 요청을 유지한다.
 * - REJECTED: 그 밖의 4xx. 서버가 처리하지 않은 것이 확실하다.
 */
export function classifySubmitError(error) {
  const code = error?.code
  if (code === 'QUIZ_CLOSED') return 'CLOSED'
  if (code === 'QUIZ_ALREADY_ATTEMPTED' || code === 'QUIZ_ATTEMPT_REQUEST_CONFLICT') return 'ALREADY_ATTEMPTED'
  if (code === 'QUIZ_PUBLISHED_REVISION_CHANGED') return 'REVISION_CHANGED'
  if (code === 'QUIZ_NOT_FOUND') return 'NOT_FOUND'
  const status = error?.status
  if (typeof status === 'number' && status >= 400 && status < 500) return 'REJECTED'
  return 'UNCERTAIN'
}

/**
 * 한 문항씩 푸는 화면의 위치. index는 문항 배열 위치이고 범위를 벗어나면 가까운 끝으로 맞춘다.
 * 문항이 없으면 number·total이 0이다.
 */
export function quizStep(index, total) {
  if (total <= 0) return { index: 0, number: 0, total: 0, isFirst: true, isLast: true }
  const clamped = Math.min(Math.max(Number.isInteger(index) ? index : 0, 0), total - 1)
  return { index: clamped, number: clamped + 1, total, isFirst: clamped === 0, isLast: clamped === total - 1 }
}

// ---- 풀던 답안 임시 저장(이 브라우저에만 남는다) ----

export const QUIZ_PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 회원·Creator·Quiz별 키. 계정을 바꿔도 다른 회원의 답이 보이지 않게 회원 ID를 포함한다. */
export function quizProgressKey(memberId, creatorId, quizId) {
  return `cking.quizProgress.v1.${memberId}.${creatorId}.${quizId}`
}

/**
 * 저장된 값에서 지금 문항에 맞는 답안만 되살린다. 문항이 바뀌었거나(revisionId 불일치) 너무 오래됐거나
 * 현재 보기에 없는 값이면 버린다. 되살릴 답이 하나도 없으면 null이다.
 */
export function restoreQuizAnswers(saved, revisionId, questions, now) {
  if (!saved || saved.revisionId !== revisionId || !saved.answers || typeof saved.answers !== 'object') return null
  if (!Number.isFinite(saved.savedAt) || saved.savedAt > now + 60 * 1000 || now - saved.savedAt > QUIZ_PROGRESS_TTL_MS) return null
  const answers = {}
  for (const question of questions) {
    const optionNo = saved.answers[question.questionNo]
    if (question.options.some((option) => option.optionNo === optionNo)) answers[question.questionNo] = optionNo
  }
  return Object.keys(answers).length > 0 ? answers : null
}

/** 이어 풀 때 시작할 문항 위치. 아직 답하지 않은 첫 문항이고, 모두 답했으면 마지막 문항이다. */
export function resumeStep(questions, answers) {
  const index = questions.findIndex((question) => answers[question.questionNo] === undefined)
  return index === -1 ? Math.max(questions.length - 1, 0) : index
}

export function readQuizProgress(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export function saveQuizProgress(storage, key, revisionId, answers, now = Date.now()) {
  try {
    storage?.setItem(key, JSON.stringify({ revisionId, answers, savedAt: now }))
  } catch {
    // 저장하지 못해도 이번 응시는 그대로 이어갈 수 있다.
  }
}

export function clearQuizProgress(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // 지우지 못해도 다음에 열 때 문항·기한 검사에서 걸러진다.
  }
}
