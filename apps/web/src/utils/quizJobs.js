// Creator AI Quiz 생성·GPT Judge 평가 같은 비동기 유료 작업의 저장·복구와 재요청 판단. 화면 상태와 분리해 단위 테스트한다.
//
// 생성과 평가는 requestId(UUID)로 멱등하다. 같은 requestId·같은 입력(대상)의 재요청은 BE가 기존 작업을 돌려주므로,
// 응답을 받지 못한 요청은 requestId를 저장해 두었다가 같은 입력이면 그대로 다시 보낸다. 작업 ID를 받은 뒤에는
// 작업 ID로 상태를 조회한다. 새로고침해도 이어 볼 수 있게 Creator별로 브라우저 저장소에 둔다(토큰·인증 정보는 두지 않는다).

export const QUIZ_TITLE_MAX = 100
export const REJECT_REASON_MAX = 500
export const QUESTION_COUNTS = [3, 5]

const STORAGE_PREFIX = 'cking.creatorQuizJobs.v1.'
// 작업 ID를 받기 전(응답 불확실) 요청은 하루, 작업 ID를 받은 요청은 30일 뒤 버린다. BE는 오래된 작업을
// 정리하므로(생성 PENDING 10분·RUNNING 15분, 평가 PENDING 15분·RUNNING 5분) 그 뒤에는 모두 끝난 상태다.
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const TRACKED_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_JUDGES = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])

const EMPTY_JOBS = Object.freeze({ generation: null, judges: Object.freeze({}) })

// ---- 입력 ----

/**
 * BE가 받는 YouTube 주소에서 videoId를 꺼낸다. 받지 않는 형식이면 null.
 * https의 youtube.com·www.youtube.com·m.youtube.com의 /watch?v=<id>·/shorts/<id>(끝 슬래시 하나 허용)와 youtu.be/<id>만 받고,
 * userinfo·443이 아닌 port·v 중복·퍼센트 인코딩된 videoId는 거부한다. 그 밖의 query와 fragment는 무시한다.
 */
export function parseYoutubeVideoId(value) {
  if (typeof value !== 'string') return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  // URL은 https의 443 port를 빈 값으로 정규화한다.
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  let id = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1)
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      const values = url.search.slice(1).split('&').filter((part) => part.split('=')[0] === 'v')
      if (values.length !== 1) return null
      id = values[0].slice(2)
    } else {
      // BE YoutubeVideoUrl의 SHORTS_PATH(/shorts/<id>/?)처럼 Shorts만 끝의 슬래시 하나를 허용한다.
      id = url.pathname.match(SHORTS_PATH)?.[1] ?? null
    }
  }
  return id && VIDEO_ID.test(id) ? id : null
}

/** 화면 입력을 요청 값으로 정리한다(앞뒤 공백 제거). */
export function generationInput({ youtubeUrl, title, questionCount }) {
  return {
    youtubeUrl: String(youtubeUrl ?? '').trim(),
    title: String(title ?? '').trim(),
    questionCount: Number(questionCount),
  }
}

/** 입력 오류 문구. 문제가 없으면 null. 최종 판단은 BE가 한다. */
export function validateGenerationInput(input) {
  if (!parseYoutubeVideoId(input.youtubeUrl)) {
    return 'YouTube 영상 주소를 확인해 주세요. (youtube.com/watch?v=…, youtube.com/shorts/…, youtu.be/…)'
  }
  if (!input.title) return 'Quiz 제목을 입력해 주세요.'
  if (input.title.length > QUIZ_TITLE_MAX) return `Quiz 제목은 ${QUIZ_TITLE_MAX}자 이하로 입력해 주세요.`
  if (!QUESTION_COUNTS.includes(input.questionCount)) return '문항 수는 3개 또는 5개만 고를 수 있어요.'
  return null
}

/** BE가 같은 입력으로 보는 값(videoId·제목·문항 수). 주소 표현이 달라도 videoId가 같으면 같은 입력이다. */
function generationInputKey(input) {
  return JSON.stringify([parseYoutubeVideoId(input.youtubeUrl) ?? input.youtubeUrl, input.title, input.questionCount])
}

// ---- 재요청 판단 ----

/**
 * 이번 생성 요청. 응답을 받지 못한 직전 요청(작업 ID 없음)과 입력이 같으면 그 요청을 그대로 쓰고,
 * 입력이 바뀌었거나 직전 작업이 이미 접수됐으면(실패 뒤 다시 만들기 등) 새 requestId를 만든다.
 */
export function generationRequestFor(stored, input, newRequestId, now) {
  if (stored && stored.generationId == null && generationInputKey(stored.input) === generationInputKey(input)) {
    return stored
  }
  return { requestId: newRequestId(), input, generationId: null, savedAt: now }
}

/** 이번 평가 요청. 응답을 받지 못한 같은 대상의 직전 요청이면 그 requestId를 쓰고, 아니면 새로 만든다. */
export function judgeRequestFor(stored, quizId, revisionId, newRequestId, now) {
  if (stored && stored.evaluationId == null && stored.quizId === quizId && stored.revisionId === revisionId) {
    return stored
  }
  return { quizId, revisionId, requestId: newRequestId(), evaluationId: null, savedAt: now }
}

/** 생성·평가 Job이 아직 진행 중인지. */
export function isActiveJob(job) {
  return job?.status === 'PENDING' || job?.status === 'RUNNING'
}

/** 조회 간격. 처음 1분은 3초, 그 뒤에는 10초마다 조회한다. */
export function pollDelay(count) {
  return count < 20 ? 3000 : 10000
}

/**
 * 평가 요청 버튼 상태.
 * - DECIDED: 이미 승인·반려한 revision(평가하지 않는다)
 * - REQUEST: 평가 기록이 없다
 * - WAIT: 평가 진행 중
 * - DONE: 평가 완료(SUCCEEDED). fail·uncertain도 완료이며 다시 평가하지 않는다
 * - RETRY: 기술적 실패(FAILED·UNKNOWN)이고 남은 횟수가 있어 새 requestId로 다시 평가할 수 있다
 * - EXHAUSTED: 기술적 실패이고 횟수(최초 포함 2회)를 모두 썼다
 */
export function judgeAction(revision, evaluation) {
  if (revision?.reviewStatus !== 'PENDING_REVIEW') return 'DECIDED'
  if (!evaluation) return 'REQUEST'
  if (isActiveJob(evaluation)) return 'WAIT'
  if (evaluation.status === 'SUCCEEDED') return 'DONE'
  return Number(evaluation.attempt) < Number(evaluation.maxAttempts) ? 'RETRY' : 'EXHAUSTED'
}

/** 승인 가능 여부. 이 revision의 평가가 SUCCEEDED이고 집계가 ALL_PASS여야 한다(SUCCEEDED만으로는 부족하다). */
export function canApprove(revision, evaluation) {
  return revision?.reviewStatus === 'PENDING_REVIEW'
    && evaluation?.revisionId === revision.revisionId
    && evaluation.status === 'SUCCEEDED'
    && evaluation.aggregation === 'ALL_PASS'
}

/** 게시 가능 여부. 승인된 최신 revision이고 그 revision을 이미 게시 중이 아니어야 한다. */
export function canPublish(quiz, revision) {
  if (!quiz || quiz.publicationStatus === 'CLOSED' || !revision || !revision.latest || revision.reviewStatus !== 'APPROVED') return false
  if (revision.origin === 'CREATOR_COMPOSED' && revision.approvalPolicyVersion !== 'CREATOR_REVIEW_V1') return false
  return !(quiz.publicationStatus === 'PUBLISHED' && quiz.publishedRevisionId === revision.revisionId)
}

// ---- 오류 ----

// 5xx지만 서버가 접수하지 않은 것이 확실한 오류(기능 꺼짐·설정 없음).
const REJECTED_5XX = new Set(['QUIZ_GENERATION_DISABLED', 'QUIZ_JUDGE_DISABLED', 'QUIZ_JUDGE_NOT_CONFIGURED'])

/**
 * 요청이 서버에서 처리됐는지 알 수 없는 오류인지. 응답을 받지 못했거나(NETWORK_ERROR 등) 서버 오류(5xx)면
 * 처리됐을 수 있으므로 같은 입력의 재시도에 같은 requestId를 써야 한다. 4xx와 기능 꺼짐 503은 접수되지 않았다.
 */
export function isUncertainError(error) {
  if (REJECTED_5XX.has(error?.code)) return false
  const status = error?.status
  return typeof status !== 'number' || status >= 500
}

const ERROR_MESSAGES = {
  QUIZ_CLOSED: '마감된 Quiz예요. 재게시하거나 내용을 변경할 수 없어요.',
  QUIZ_CLOSE_NOT_ALLOWED: '게시 중이거나 게시 중지한 Quiz만 마감할 수 있어요.',
  QUIZ_REVISION_CONFLICT: '편집 기준이 바뀌었거나 hash가 달라요. 최신 Revision을 확인해 주세요.',
  QUIZ_EDIT_REQUEST_CONFLICT: '같은 저장 UUID의 요청 내용이 달라요. 기존 저장 기록을 확인해 주세요.',
  QUIZ_CONTENT_LOCKED: '최초 게시한 Quiz는 게시 취소 후에도 편집할 수 없어요.',
  QUIZ_GENERATION_REQUEST_CONFLICT: '이전 생성 요청과 입력이 달라 처리하지 못했어요. 다시 요청해 주세요.',
  QUIZ_GENERATION_IN_PROGRESS: '이미 진행 중인 Quiz 생성이 있어요. 끝난 뒤 다시 요청해 주세요.',
  QUIZ_GENERATION_CONTENT_CONFLICT: '다른 원문으로 이미 확정됐어요. 최신 상태를 확인해 주세요.',
  QUIZ_GENERATION_NOT_AWAITING_REVIEW: '이미 원문 검토 대기가 끝났어요. 최신 상태를 확인해 주세요.',
  QUIZ_GENERATION_DISABLED: '지금은 AI Quiz 생성 기능을 사용할 수 없어요.',
  QUIZ_GENERATION_NOT_FOUND: '생성 작업을 찾을 수 없어요.',
  QUIZ_JUDGE_REQUEST_CONFLICT: '이전 평가 요청과 대상이 달라 처리하지 못했어요. 다시 요청해 주세요.',
  QUIZ_JUDGE_IN_PROGRESS: '진행 중인 다른 평가가 있어요. 끝난 뒤 다시 요청해 주세요.',
  QUIZ_JUDGE_ATTEMPT_LIMIT_REACHED: '평가 요청 횟수(최초 포함 2회)를 모두 사용했어요.',
  QUIZ_JUDGE_EVALUATION_COMPLETED: '이미 평가를 마친 revision이에요. 결과는 평가를 요청한 기기에서만 다시 볼 수 있어요.',
  QUIZ_JUDGE_REVISION_APPROVED: '이미 승인한 revision이에요.',
  QUIZ_JUDGE_SETTINGS_MISMATCH: '평가 설정이 바뀌어 지금은 다시 평가할 수 없어요.',
  QUIZ_JUDGE_DISABLED: '지금은 GPT Judge 평가 기능을 사용할 수 없어요.',
  QUIZ_JUDGE_NOT_CONFIGURED: '지금은 GPT Judge 평가 기능을 사용할 수 없어요.',
  QUIZ_JUDGE_EVALUATION_NOT_FOUND: '평가 기록을 찾을 수 없어요.',
  QUIZ_JUDGE_EVALUATION_REQUIRED: 'GPT Judge 평가에서 모든 항목이 통과(ALL_PASS)해야 승인·게시할 수 있어요.',
  QUIZ_JUDGE_EVALUATION_INTEGRITY_FAILED: '저장된 평가 결과를 검증하지 못했어요.',
  QUIZ_REVISION_ALREADY_DECIDED: '이미 승인 또는 반려한 revision이에요.',
  QUIZ_REVISION_NOT_LATEST: '최신 revision만 게시할 수 있어요.',
  QUIZ_REVISION_NOT_APPROVED: '승인한 revision만 게시할 수 있어요.',
  QUIZ_REVISION_INTEGRITY_FAILED: '저장된 Quiz 내용을 검증하지 못했어요.',
  QUIZ_NOT_FOUND: 'Quiz를 찾을 수 없어요.',
  QUIZ_REVISION_NOT_FOUND: 'revision을 찾을 수 없어요.',
  FORBIDDEN: '내 Quiz만 관리할 수 있어요. Creator 계정인지 확인해 주세요.',
}

/** 화면에 보여줄 오류 문구. 계약에 있는 코드는 정해진 문구, 그 밖의 서버 오류는 서버 문구, 나머지는 fallback. */
export function creatorQuizErrorMessage(error, fallback) {
  if (ERROR_MESSAGES[error?.code]) return ERROR_MESSAGES[error.code]
  if (error?.code === 'NETWORK_ERROR' || !error?.code) return fallback
  return error.message || fallback
}

const GENERATION_FAILURES = {
  GROUNDING_REJECTED: '영상을 분석할 수 없었어요. 공개 영상인지 확인해 주세요.',
  GROUNDING_INVALID: '영상 분석 결과가 기준에 맞지 않았어요.',
  GENERATION_INVALID: '생성된 문항이 기준에 맞지 않았어요.',
  DRAFT_INVALID: '생성된 문항이 저장 기준(길이 등)에 맞지 않았어요.',
  CANCELLED: 'Quiz 생성을 취소했어요.',
  PROVIDER_ERROR: 'AI 서비스 오류로 만들지 못했어요.',
  PROVIDER_TIMEOUT: 'AI 응답 시간이 초과돼 결과를 알 수 없어요.',
  DISPATCH_REJECTED: '생성 대기열이 가득 찼어요. 잠시 후 다시 요청해 주세요.',
  STALE_PENDING: '생성이 오래 시작되지 않아 취소됐어요.',
  STALE_RUNNING: '생성이 너무 오래 걸려 결과를 알 수 없어요.',
  INTERNAL_ERROR: '서버 오류로 만들지 못했어요.',
}

/** 생성 실패(FAILED·UNKNOWN) 안내. BE는 자동으로 다시 시도하지 않으므로 새 요청이 필요하다. */
export function generationFailureMessage(job) {
  return GENERATION_FAILURES[job?.failureCode] ?? 'Quiz를 만들지 못했어요.'
}

const JUDGE_FAILURES = {
  PROVIDER_TIMEOUT: 'AI 응답 시간이 초과돼 결과를 알 수 없어요.',
  EXECUTION_TIMEOUT: '평가 시간이 초과돼 결과를 알 수 없어요.',
  EXECUTION_INTERRUPTED: '평가가 중단돼 결과를 알 수 없어요.',
  STALE_RUNNING: '평가가 너무 오래 걸려 결과를 알 수 없어요.',
  PROVIDER_ERROR: 'AI 서비스 오류로 평가하지 못했어요.',
  PROVIDER_REJECTED: 'AI 서비스가 요청을 거부했어요.',
  PROVIDER_REFUSAL: 'AI가 평가를 거절했어요.',
  INCOMPLETE_RESPONSE: 'AI 응답이 완전하지 않았어요.',
  INVALID_RESPONSE: 'AI 응답 형식이 올바르지 않았어요.',
  NOT_CONFIGURED: '평가 기능 설정이 없어 평가하지 못했어요.',
  SETTINGS_MISMATCH: '평가 설정이 바뀌어 평가하지 못했어요.',
  INTEGRITY_FAILED: 'Quiz 내용을 검증하지 못해 평가하지 못했어요.',
  DISPATCH_REJECTED: '평가 대기열이 가득 찼어요. 잠시 후 다시 요청해 주세요.',
  STALE_PENDING: '평가가 오래 시작되지 않아 취소됐어요.',
  INTERNAL_ERROR: '서버 오류로 평가하지 못했어요.',
}

export function judgeFailureMessage(evaluation) {
  return JUDGE_FAILURES[evaluation?.failureCode] ?? '평가하지 못했어요.'
}

// ---- 저장·복구 ----

export function quizJobsKey(creatorId) {
  return `${STORAGE_PREFIX}${creatorId}`
}

/** 브라우저 저장소. 쓸 수 없는 환경(비공개 모드 제한, 테스트)이면 null이며 이때는 저장 없이 동작한다. */
export function browserStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0
const isUuid = (value) => typeof value === 'string' && UUID.test(value)

function fresh(savedAt, tracked, now) {
  if (!Number.isFinite(savedAt) || savedAt > now + 60 * 1000) return false
  return now - savedAt <= (tracked ? TRACKED_TTL_MS : PENDING_TTL_MS)
}

function pendingPostsOf(value) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([id, state]) => isUuid(id) && ['WAITING', 'UNCERTAIN'].includes(state)))
}

function pendingPostFields(value) {
  const pendingPosts = pendingPostsOf(value)
  return Object.keys(pendingPosts).length ? { pendingPosts } : {}
}

function sanitizeGeneration(value, now) {
  if (!value || typeof value !== 'object' || !isUuid(value.requestId)) return null
  const input = value.input
  if (!input || typeof input.youtubeUrl !== 'string' || typeof input.title !== 'string') return null
  if (!QUESTION_COUNTS.includes(input.questionCount) || input.title.length > QUIZ_TITLE_MAX) return null
  const generationId = value.generationId ?? null
  if (generationId !== null && !isPositiveId(generationId)) return null
  if (!fresh(value.savedAt, generationId !== null, now)) return null
  return {
    requestId: value.requestId,
    input: { youtubeUrl: input.youtubeUrl, title: input.title, questionCount: input.questionCount },
    generationId,
    savedAt: value.savedAt,
    ...pendingPostFields(value.pendingPosts),
  }
}

function sanitizeJudge(value, now) {
  if (!value || typeof value !== 'object' || !isUuid(value.requestId)) return null
  if (!isPositiveId(value.quizId) || !isPositiveId(value.revisionId)) return null
  const evaluationId = value.evaluationId ?? null
  if (evaluationId !== null && !isPositiveId(evaluationId)) return null
  if (!fresh(value.savedAt, evaluationId !== null, now)) return null
  return { quizId: value.quizId, revisionId: value.revisionId, requestId: value.requestId, evaluationId, savedAt: value.savedAt,
    ...pendingPostFields(value.pendingPosts) }
}

/** 저장 문자열을 읽는다. 형식이 틀리거나 오래된 항목은 버린다. */
export function parseQuizJobs(raw, now) {
  let value
  try {
    value = raw ? JSON.parse(raw) : null
  } catch {
    return EMPTY_JOBS
  }
  if (!value || typeof value !== 'object') return EMPTY_JOBS
  const judges = Object.values(value.judges && typeof value.judges === 'object' ? value.judges : {})
    .map((entry) => sanitizeJudge(entry, now))
    .filter(Boolean)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_JUDGES)
  return {
    generation: sanitizeGeneration(value.generation, now),
    judges: Object.fromEntries(judges.map((entry) => [String(entry.revisionId), entry])),
  }
}

export function readQuizJobs(storage, creatorId, now) {
  return readQuizJobsChecked(storage, creatorId, now).jobs
}

/** 정상적인 빈 저장값과 저장소 접근 실패를 구분한다. */
export function readQuizJobsChecked(storage, creatorId, now) {
  if (!storage) return { ok: false, jobs: EMPTY_JOBS }
  try {
    return { ok: true, jobs: parseQuizJobs(storage.getItem(quizJobsKey(creatorId)), now) }
  } catch {
    return { ok: false, jobs: EMPTY_JOBS }
  }
}

/** 조건부 변경과 쓰기·재조회가 성공했을 때만 applied다. 탭 사이의 원자적 잠금을 제공하지는 않는다. */
export function updateQuizJobsChecked(storage, creatorId, update, now) {
  const current = readQuizJobsChecked(storage, creatorId, now)
  if (!current.ok) return { ...current, applied: false }
  const updated = update(current.jobs)
  if (updated === current.jobs) return { ...current, applied: false }
  const next = parseQuizJobs(JSON.stringify(updated), now)
  const raw = JSON.stringify(next)
  try {
    storage.setItem(quizJobsKey(creatorId), raw)
    const saved = storage.getItem(quizJobsKey(creatorId))
    return { ok: true, applied: saved === raw, jobs: parseQuizJobs(saved, now) }
  } catch {
    return { ok: false, applied: false, jobs: current.jobs }
  }
}

/** 같은 출처의 탭들이 읽기·조건 비교·쓰기를 하나의 Creator 잠금 안에서 수행한다. 미지원 환경은 신규 요청을 차단한다. */
export async function updateQuizJobsLocked(storage, creatorId, update, now) {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    return { ok: false, applied: false, jobs: EMPTY_JOBS }
  }
  try {
    return await navigator.locks.request(quizJobsKey(creatorId), () => updateQuizJobsChecked(storage, creatorId, update, now))
  } catch {
    return { ok: false, applied: false, jobs: EMPTY_JOBS }
  }
}

/**
 * 저장값을 바꾼다. 생성과 평가를 서로 다른 화면이 고치므로 매번 저장소에서 다시 읽은 값에 update를 적용한다.
 * 저장에 실패해도(용량 초과 등) 바뀐 값을 돌려주므로 이번 화면에서는 그대로 이어서 동작한다.
 */
export function updateQuizJobs(storage, creatorId, update, now) {
  const current = readQuizJobs(storage, creatorId, now)
  const next = parseQuizJobs(JSON.stringify(update(current)), now)
  if (storage) {
    try {
      if (!next.generation && Object.keys(next.judges).length === 0) storage.removeItem(quizJobsKey(creatorId))
      else storage.setItem(quizJobsKey(creatorId), JSON.stringify(next))
    } catch {
      // 저장하지 못하면 새로고침 뒤 복구만 안 된다.
    }
  }
  return next
}

export const withGeneration = (generation) => (jobs) => ({ ...jobs, generation })

export const withJudge = (revisionId, entry) => (jobs) => {
  const judges = { ...jobs.judges }
  if (entry) judges[String(revisionId)] = entry
  else delete judges[String(revisionId)]
  return { ...jobs, judges }
}

// 같은 Creator 화면을 여러 탭에서 열면 다른 탭이 그 사이 저장값을 바꿀 수 있다. 지우거나 되돌릴 때는 저장값이 아직
// 이 화면이 알던 요청(expectedRequestId, 없으면 null)일 때만 바꿔 다른 탭의 최신 요청을 덮어쓰거나 지우지 않는다.
export const withGenerationIf = (expectedRequestId, generation) => (jobs) => (
  (jobs.generation?.requestId ?? null) === expectedRequestId ? { ...jobs, generation } : jobs
)

export const withJudgeIf = (revisionId, expectedRequestId, entry) => (jobs) => (
  (jobs.judges[String(revisionId)]?.requestId ?? null) === expectedRequestId ? withJudge(revisionId, entry)(jobs) : jobs
)

// 같은 UUID 재전송도 개별 POST의 대기 상태를 공유한다. 작업 ID가 바뀌었으면 보내지 않는다.
export const withGenerationPost = (requestId, generationId, postId) => (jobs) => {
  const current = jobs.generation
  if (current?.requestId !== requestId || current.generationId !== generationId) return jobs
  return { ...jobs, generation: { ...current, pendingPosts: { ...pendingPostsOf(current.pendingPosts), [postId]: 'WAITING' } } }
}

export const withJudgePost = (revisionId, requestId, evaluationId, postId) => (jobs) => {
  const current = jobs.judges[String(revisionId)]
  if (current?.requestId !== requestId || current.evaluationId !== evaluationId) return jobs
  return withJudge(revisionId, { ...current, pendingPosts: { ...pendingPostsOf(current.pendingPosts), [postId]: 'WAITING' } })(jobs)
}

/** 개별 실패는 공유 작업의 실패가 아니다. 작업 ID·다른 대기/불확실 시도를 우선 보존한다. */
function failedPostEntry(current, idField, requestId, postId, error, settled, fallback) {
  if (current?.requestId !== requestId) return current
  const pendingPosts = pendingPostsOf(current.pendingPosts)
  const owned = Object.hasOwn(pendingPosts, postId)
  if (owned && isUncertainError(error)) pendingPosts[postId] = 'UNCERTAIN'
  else delete pendingPosts[postId]
  // 이 POST의 예약이 아직 있고, 접수된 작업도 다른 미확인 POST도 없을 때만 명확한 거절로 정리한다.
  if (current[idField] === null && owned && settled && Object.keys(pendingPosts).length === 0) return fallback
  return { ...current, pendingPosts }
}

export const withGenerationPostFailure = (requestId, postId, error, fallback) => (jobs) => {
  const next = failedPostEntry(jobs.generation, 'generationId', requestId, postId, error, canDropUnconfirmedGeneration(error), fallback)
  return next === jobs.generation ? jobs : { ...jobs, generation: next }
}

const JUDGE_REPLAY_SETTLED = new Set(['QUIZ_JUDGE_DISABLED', 'QUIZ_JUDGE_NOT_CONFIGURED', 'QUIZ_JUDGE_IN_PROGRESS',
  'QUIZ_JUDGE_REQUEST_CONFLICT', 'QUIZ_JUDGE_ATTEMPT_LIMIT_REACHED', 'QUIZ_JUDGE_EVALUATION_COMPLETED',
  'QUIZ_JUDGE_REVISION_APPROVED', 'QUIZ_JUDGE_SETTINGS_MISMATCH'])

export const withJudgePostFailure = (revisionId, requestId, postId, error, fallback) => (jobs) => {
  const current = jobs.judges[String(revisionId)]
  const next = failedPostEntry(current, 'evaluationId', requestId, postId, error, JUDGE_REPLAY_SETTLED.has(error?.code), fallback)
  return next === current ? jobs : withJudge(revisionId, next)(jobs)
}

/**
 * 새 생성 요청을 막아야 하는 이유. 요청 직전에 저장소에서 다시 읽은 값(latest)으로 판단한다.
 * - ACTIVE: 작업 ID를 받은 요청이 있고 이 화면에서 아직 끝난 것을 확인하지 못했다(다른 탭이 시작한 작업 포함)
 * - UNCONFIRMED: 결과를 확인하지 못한 요청이 있는데 입력이 다르다. 그 요청이 접수됐을 수 있어 먼저 확인해야 한다
 * null이면 보낼 수 있다(같은 입력의 미확인 요청이면 generationRequestFor가 그 requestId를 다시 쓴다).
 */
export function generationStartBlock(latest, input, knownJob) {
  if (!latest) return null
  if (latest.generationId !== null) {
    return knownJob?.generationId === latest.generationId && !isActiveJob(knownJob) ? null : 'ACTIVE'
  }
  return generationInputKey(latest.input) === generationInputKey(input) ? null : 'UNCONFIRMED'
}

/** 평가 요청을 막아야 하는지. 평가 ID를 받은 요청이 있고 이 화면에서 아직 끝난 것을 확인하지 못했으면 막는다. */
export function judgeStartBlocked(latest, knownEvaluation) {
  if (!latest || latest.evaluationId === null) return false
  return !(knownEvaluation?.evaluationId === latest.evaluationId && !isActiveJob(knownEvaluation))
}

// BE가 기존 requestId를 확인한 뒤 반환하는 명확한 거절 코드다. 이 분류만으로 공유 요청을 삭제하지 않는다.
// 작업 ID가 없고 다른 POST가 대기·불확실 상태가 아닐 때만 withGenerationPostFailure가 정리한다.
const GENERATION_REPLAY_SETTLED = new Set(['QUIZ_GENERATION_DISABLED', 'QUIZ_GENERATION_IN_PROGRESS', 'QUIZ_GENERATION_REQUEST_CONFLICT'])

/** 미확인 생성 요청을 같은 requestId로 다시 보냈을 때 받은 오류로 그 요청을 정리해도 되는지. */
export function canDropUnconfirmedGeneration(error) {
  return GENERATION_REPLAY_SETTLED.has(error?.code)
}
