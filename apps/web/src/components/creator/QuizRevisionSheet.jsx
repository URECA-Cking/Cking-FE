import { useCallback, useEffect, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import ConfirmSheet from '../ui/ConfirmSheet.jsx'
import QuizCompositionPanel from './QuizCompositionPanel.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { ErrorBlock, LoadingBlock, Spinner, StatusPill } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { newRequestId } from '../../api/client.js'
import {
  approveQuizRevision,
  closeQuiz,
  approveQuizByCreator,
  getJudgeEvaluation,
  getMyQuiz,
  getMyQuizRevision,
  publishQuiz,
  rejectQuizRevision,
  requestJudgeEvaluation,
  unpublishQuiz,
} from '../../api/creatorQuizzes.js'
import { formatDateTime } from '../../utils/format.js'
import { CONTENT_REVIEW_LABELS, PUBLICATION_LABELS, REVIEW_LABELS } from './quizLabels.js'
import {
  REJECT_REASON_MAX,
  browserStorage,
  canApprove,
  canPublish,
  creatorQuizErrorMessage,
  isActiveJob,
  isUncertainError,
  judgeAction,
  judgeFailureMessage,
  judgeRequestFor,
  judgeStartBlocked,
  pollDelay,
  quizJobsKey,
  readQuizJobs,
  readQuizJobsChecked,
  updateQuizJobsLocked,
  withJudgeIf,
  withJudgePost,
  withJudgePostFailure,
} from '../../utils/quizJobs.js'

const JUDGE_LABELS = {
  PENDING: '평가 대기 중',
  RUNNING: '평가 중',
  SUCCEEDED: '평가 완료',
  FAILED: '평가 실패',
  UNKNOWN: '결과 확인 불가',
}

const AGGREGATION_LABELS = {
  ALL_PASS: { label: '모두 통과', icon: 'check_circle', tone: 'bg-primary text-on-primary' },
  HAS_FAIL: { label: '미통과 항목 있음', icon: 'cancel', tone: 'bg-error-container text-on-error-container' },
  UNCERTAIN_ONLY: { label: '판단 보류 항목 있음', icon: 'help', tone: 'bg-surface-container-high text-on-surface' },
}

// 문항마다 평가하는 7개 항목(judge-api.md).
const JUDGE_ITEMS = [
  ['textAnswerCorrect', '정답이 원문과 일치'],
  ['uniqueAnswer', '정답이 하나'],
  ['evidenceSupportsAnswer', '근거가 정답을 뒷받침'],
  ['questionClarity', '질문이 명확'],
  ['koreanQuality', '한국어 품질'],
  ['distractorQuality', '오답 보기 품질'],
  ['textFaithfulness', '원문 밖 내용 없음'],
]

const VERDICTS = {
  pass: { label: '통과', icon: 'check_circle', className: 'text-primary' },
  fail: { label: '미통과', icon: 'cancel', className: 'text-error' },
  uncertain: { label: '보류', icon: 'help', className: 'text-on-surface-variant' },
}

// 상태 조회가 이 횟수만큼 연달아 실패하면 자동 조회를 멈추고 "다시 확인"을 보여준다.
const POLL_FAILURE_MAX = 3

// 화면의 Quiz·revision 상태가 서버와 달라졌다는 뜻이라 다시 불러오는 오류.
const STALE_CODES = new Set([
  'QUIZ_CLOSED',
  'QUIZ_CLOSE_NOT_ALLOWED',
  'QUIZ_REVISION_CONFLICT',
  'QUIZ_CONTENT_LOCKED',
  'QUIZ_REVISION_ALREADY_DECIDED',
  'QUIZ_REVISION_NOT_LATEST',
  'QUIZ_REVISION_NOT_APPROVED',
  'QUIZ_JUDGE_EVALUATION_REQUIRED',
  'QUIZ_JUDGE_REVISION_APPROVED',
  'QUIZ_NOT_FOUND',
  'QUIZ_REVISION_NOT_FOUND',
])

const buttonClass =
  'rounded-xl px-4 py-2.5 font-label-sm text-label-sm font-semibold active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
const sectionClass = 'flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md'

/**
 * 내 Quiz 검토 시트. Quiz 상세(GET /api/creator/quizzes/{quizId})와 revision 상세(문항·정답·해설·근거)를 보여주고,
 * GPT Judge 평가 요청·조회, 승인(ALL_PASS일 때만)·반려, 게시·게시 중지를 한다.
 */
export default function QuizRevisionSheet(props) {
  return <QuizReview key={`${props.creatorId}:${props.quizId}`} {...props} />
}

function QuizReview({ creatorId, quizId, initialRevisionId, onClose, onChanged }) {
  // 마감은 Revision이 아닌 Quiz의 최종 상태다. 늦은 게시 상태 응답으로 되돌리지 않는다.
  const [closedResult, setClosedResult] = useState(null)
  const [staleQuiz, setStaleQuiz] = useState(null)
  function observeClosed(result) {
    if (result?.publicationStatus === 'CLOSED') {
      setClosedResult(current => ({
        publicationStatus: 'CLOSED',
        closedAt: result.closedAt ?? current?.closedAt ?? null,
      }))
    }
  }
  const quiz = useAsync(async () => {
    const latest = await getMyQuiz(quizId)
    observeClosed(latest)
    return latest
  }, [quizId], { fallbackMessage: 'Quiz를 불러오지 못했어요.' })
  const shownQuiz = closedResult && quiz.data
    ? { ...quiz.data, publicationStatus: 'CLOSED', closedAt: closedResult.closedAt ?? quiz.data.closedAt }
    : quiz.data
  const revisions = quiz.data?.revisions ?? []
  const [selected, setSelected] = useState(initialRevisionId ?? null)
  const revisionId = selected ?? revisions.at(-1)?.revisionId ?? null
  const title = revisions.find((item) => item.revisionId === revisionId)?.title ?? 'Quiz 검토'

  async function handleChanged() {
    const latest = await quiz.reload()
    onChanged?.()
    return latest
  }

  return (
    <BottomSheet open onClose={onClose} title={title} eyebrow="내 Quiz">
      {!quiz.data && quiz.loading && <LoadingBlock label="Quiz를 불러오는 중..." />}
      {!quiz.data && !quiz.loading && quiz.error && <ErrorBlock message={quiz.error} onRetry={quiz.reload} />}
      {quiz.data && (
        <div className="flex flex-col gap-space-md">
          {revisions.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="revision 선택">
              {revisions.map((item) => (
                <button
                  key={item.revisionId}
                  type="button"
                  aria-pressed={item.revisionId === revisionId}
                  onClick={() => setSelected(item.revisionId)}
                  className={`rounded-full px-3 py-1.5 font-label-xs text-label-xs font-semibold ${
                    item.revisionId === revisionId ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  revision {item.revisionNo}
                </button>
              ))}
            </div>
          )}
          {revisionId !== null && (
            <RevisionReview
              key={revisionId}
              creatorId={creatorId}
              quiz={shownQuiz}
              revisionId={revisionId}
              publicationPending={staleQuiz === quiz.data}
              onPublicationStale={(result) => { setStaleQuiz(quiz.data); observeClosed(result) }}
              onChanged={handleChanged}
              onCompositionSaved={(saved) => { setSelected(saved.revisionId); handleChanged() }}
            />
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/**
 * revision의 GPT Judge 평가 상태. 평가 요청 정보는 Creator별로 브라우저에 저장해 새로고침 뒤에도 평가 ID로 이어서
 * 조회한다. BE에는 revision의 최근 평가를 찾는 API가 없어서 저장값이 없는 기기에서는 이전 평가를 볼 수 없다.
 */
function useJudgeEvaluation(creatorId, quizId, revisionId, onRevisionStale) {
  const showToast = useToast()
  const storage = browserStorage()
  const [stored, setStored] = useState(() => readQuizJobs(storage, creatorId, Date.now()).judges[String(revisionId)] ?? null)
  const storedRef = useRef(stored)
  const [evaluation, setEvaluation] = useState(null)
  const [polls, setPolls] = useState(0)
  const [pollFailures, setPollFailures] = useState(0)
  const [requesting, setRequesting] = useState(false)
  const [notice, setNotice] = useState(null)
  const inFlight = useRef(false)
  const onStaleRef = useRef(onRevisionStale)
  useEffect(() => {
    onStaleRef.current = onRevisionStale
  }, [onRevisionStale])

  const evaluationId = stored?.evaluationId ?? null
  const storedRequestId = stored?.requestId ?? null
  const tracked = evaluation && evaluation.evaluationId === evaluationId ? evaluation : null
  // 저장값을 지운 뒤(승인·반려 후)나 응답 불확실한 재요청 중에도 마지막으로 받은 평가는 계속 보여준다.
  const shown = tracked ?? (evaluationId === null ? evaluation : null)
  const tracking = evaluationId !== null && (tracked === null || isActiveJob(tracked))
  const pollStopped = pollFailures >= POLL_FAILURE_MAX

  const update = useCallback(async (updater, memoryOnFailure = false) => {
    const changed = await updateQuizJobsLocked(storage, creatorId, updater, Date.now())
    if (changed.ok) {
      storedRef.current = changed.jobs.judges[String(revisionId)] ?? null
      setStored(storedRef.current)
    } else if (memoryOnFailure) {
      const current = { generation: null, judges: storedRef.current ? { [revisionId]: storedRef.current } : {} }
      const next = updater(current)
      changed.applied = next !== current
      storedRef.current = next.judges[String(revisionId)] ?? null
      setStored(storedRef.current)
    }
    return changed
  }, [storage, creatorId, revisionId])

  // 다른 탭이 이 Creator의 저장값을 바꾸면 이 revision의 평가 요청을 다시 읽는다.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const key = quizJobsKey(creatorId)
    function handleStorage(event) {
      if (event.key !== null && event.key !== key) return
      const snapshot = readQuizJobsChecked(storage, creatorId, Date.now())
      if (!snapshot.ok) return
      storedRef.current = snapshot.jobs.judges[String(revisionId)] ?? null
      setStored(storedRef.current)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storage, creatorId, revisionId])

  useEffect(() => {
    if (!tracking || pollStopped) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const latest = await getJudgeEvaluation(quizId, revisionId, evaluationId)
        if (cancelled) return
        setPollFailures(0)
        setEvaluation(latest)
      } catch (error) {
        if (cancelled) return
        if (error?.status === 404 || error?.status === 403) {
          await update(withJudgeIf(revisionId, storedRequestId, null), true)
          showToast(creatorQuizErrorMessage(error, '평가 기록을 찾을 수 없어요.'), { icon: 'error' })
        } else {
          setPollFailures((count) => count + 1)
        }
      } finally {
        if (!cancelled) setPolls((count) => count + 1)
      }
    }, tracked ? pollDelay(polls) : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tracking, pollStopped, evaluationId, storedRequestId, tracked, polls, quizId, revisionId, storage, creatorId, showToast, update])

  async function request() {
    if (inFlight.current) return
    // 다른 탭이 그 사이 평가를 요청했을 수 있어 화면 상태가 아니라 저장소의 최신 값으로 판단한다.
    const snapshot = readQuizJobsChecked(storage, creatorId, Date.now())
    const previous = snapshot.ok ? snapshot.jobs.judges[String(revisionId)] ?? null : storedRef.current
    storedRef.current = previous
    setStored(previous)
    if (judgeStartBlocked(previous, evaluation)) {
      setNotice('진행 중이거나 상태를 확인하고 있는 평가가 있어요. 결과를 확인한 뒤 다시 요청해 주세요.')
      return
    }
    // 응답을 받지 못한 같은 대상의 요청이면 같은 requestId로 다시 보낸다(BE가 기존 Job을 돌려준다).
    const entry = judgeRequestFor(previous, quizId, revisionId, newRequestId, Date.now())
    const replaying = entry === previous
    const postId = newRequestId()
    inFlight.current = true
    setRequesting(true)
    {
      const reserved = await update(replaying
        ? withJudgePost(revisionId, entry.requestId, entry.evaluationId, postId)
        : withJudgeIf(revisionId, previous?.requestId ?? null, { ...entry, pendingPosts: { [postId]: 'WAITING' } }), replaying)
      if (!reserved.applied || (!replaying && !reserved.ok)) {
        inFlight.current = false
        setRequesting(false)
        setNotice('평가 요청 정보를 안전하게 저장하지 못했어요. 저장소 상태나 다른 탭의 작업을 확인해 주세요.')
        return
      }
    }
    setNotice(null)
    try {
      const job = await requestJudgeEvaluation(quizId, revisionId, { requestId: entry.requestId })
      if (!(await update(withJudgeIf(revisionId, entry.requestId, { ...entry, evaluationId: job.evaluationId, pendingPosts: {} }), true)).applied) return
      // 끝난 Job의 재요청이면 문항별 결과를 상세 조회로 다시 읽는다.
      setEvaluation(isActiveJob(job) ? job : null)
      setPolls(0)
      setPollFailures(0)
    } catch (error) {
      await update(withJudgePostFailure(revisionId, entry.requestId, postId, error, replaying ? null : previous), true)
      if (isUncertainError(error)) {
        setNotice('평가 요청 결과를 확인하지 못했어요. 다시 확인하면 같은 요청으로 이어서 처리해요.')
      } else {
        // 개별 거절 응답만으로 다른 탭의 접수·진행 상태를 삭제하지 않는다.
        setNotice(creatorQuizErrorMessage(error, 'GPT Judge 평가를 요청하지 못했어요.'))
        if (STALE_CODES.has(error?.code)) onStaleRef.current?.(error)
      }
    } finally {
      inFlight.current = false
      setRequesting(false)
    }
  }

  return {
    evaluation: shown,
    // 저장된 평가 ID의 상태를 아직 모른다(새로고침 직후 등). 이때는 새 평가 요청을 받지 않는다.
    checking: evaluationId !== null && tracked === null,
    // 응답을 받지 못해 결과를 확인해야 하는 요청이 있다.
    unconfirmed: stored !== null && evaluationId === null,
    requesting,
    notice,
    pollStopped,
    retryPoll: () => setPollFailures(0),
    request,
    // 승인·반려로 평가가 더 필요 없으면 저장값만 지운다.
    forget: () => update(withJudgeIf(revisionId, storedRequestId, null)),
  }
}

function RevisionReview({ creatorId, quiz, revisionId, onChanged, onCompositionSaved, publicationPending, onPublicationStale }) {
  const showToast = useToast()
  const quizId = quiz.quizId
  const revision = useAsync(() => getMyQuizRevision(quizId, revisionId), [quizId, revisionId], {
    fallbackMessage: '문항을 불러오지 못했어요.',
  })
  const [busy, setBusy] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [responsibleHash, setResponsibleHash] = useState(null)
  const [staleData, setStaleData] = useState(null)
  const judge = useJudgeEvaluation(creatorId, quizId, revisionId, (error) => {
    revision.reload()
    if (error?.code === 'QUIZ_CLOSED') {
      onPublicationStale({ publicationStatus: 'CLOSED' })
      setConfirming(null)
      onChanged()
    }
  })
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  // 승인·반려·게시 요청이 겹쳐 나가지 않게 한다.
  const actionInFlight = useRef(false)

  const data = revision.data
  const evaluation = judge.evaluation && judge.evaluation.revisionId === revisionId ? judge.evaluation : null
  const action = data ? judgeAction(data, evaluation) : null
  const composed = data?.origin === 'CREATOR_COMPOSED'
  const closed = quiz.publicationStatus === 'CLOSED'
  const blocked = closed || publicationPending
  const approvable = !blocked && data !== staleData && (composed ? data.latest && !data.contentLocked && data.reviewStatus === 'PENDING_REVIEW' && !!data.revisionSha256 : canApprove(data, evaluation))
  const publishable = !blocked && data !== staleData && canPublish(quiz, data)
  const publication = PUBLICATION_LABELS[closed ? 'CLOSED' : quiz.publicationStatus] ?? PUBLICATION_LABELS.NOT_PUBLISHED
  const judgedByNo = new Map((evaluation?.status === 'SUCCEEDED' ? evaluation.questions ?? [] : []).map((item) => [item.questionNo, item]))

  async function run(kind, task, successMessage, { forgetJudge = false } = {}) {
    if (blocked || actionInFlight.current || data === staleData) return
    actionInFlight.current = true
    setBusy(kind)
    try {
      const result = await task()
      if (kind === 'close') onPublicationStale(result)
      if (!active.current) return
      showToast(successMessage)
      setConfirming(null)
      setReason('')
      if (forgetJudge) await judge.forget()
      revision.reload()
      await onChanged()
    } catch (error) {
      if (error.code === 'QUIZ_CLOSED') onPublicationStale({ publicationStatus: 'CLOSED' })
      if (!active.current) return
      showToast(creatorQuizErrorMessage(error, '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'), { icon: 'error' })
      if (kind === 'close' || STALE_CODES.has(error?.code)) {
        setConfirming(null)
        setResponsibleHash(null)
        if (kind === 'close' && error.code !== 'QUIZ_CLOSED') onPublicationStale(null)
        if (error.code === 'QUIZ_REVISION_CONFLICT' || error.code === 'QUIZ_CONTENT_LOCKED') setStaleData(data)
        revision.reload()
        await onChanged()
      }
    } finally {
      actionInFlight.current = false
      if (active.current) setBusy(null)
    }
  }

  if (!data && revision.loading) return <LoadingBlock label="문항을 불러오는 중..." />
  if (!data && revision.error) return <ErrorBlock message={revision.error} onRetry={revision.reload} />
  if (!data) return null

  if (editing && !blocked) return <QuizCompositionPanel creatorId={creatorId} quizId={quizId} revision={data} onClose={() => setEditing(false)} onSaved={onCompositionSaved} onQuizClosed={() => {
    onPublicationStale({ publicationStatus: 'CLOSED' })
    setEditing(false)
    onChanged()
  }} />

  const review = REVIEW_LABELS[data.reviewStatus] ?? REVIEW_LABELS.PENDING_REVIEW
  const contentReview = typeof data.contentEdited === 'boolean' ? CONTENT_REVIEW_LABELS[data.contentEdited] : null
  const trimmedReason = reason.trim()

  return (
    <div className="flex flex-col gap-space-md">
      {/* 게시 상태 */}
      <section className={sectionClass} aria-label="게시">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md font-semibold text-on-surface">게시 상태</span>
          <StatusPill label={publication.label} icon={publication.icon} tone={publication.tone} />
        </div>
        {!closed && quiz.publicationStatus === 'PUBLISHED' && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {quiz.publishedRevisionId === revisionId ? '이 revision을 팬에게 공개하고 있어요.' : '다른 revision을 공개하고 있어요.'}
            {quiz.publishedAt && ` · ${formatDateTime(quiz.publishedAt)} 게시`}
          </p>
        )}
        {quiz.publicationStatus === 'UNPUBLISHED' && quiz.unpublishedAt && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">{formatDateTime(quiz.unpublishedAt)} 게시 중지</p>
        )}
        {data.reviewStatus === 'APPROVED' && !data.latest && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">최신 revision만 게시할 수 있어요.</p>
        )}
        {!closed && data.reviewStatus !== 'APPROVED' && quiz.publicationStatus !== 'PUBLISHED' && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">승인한 revision을 게시할 수 있어요.</p>
        )}
        {closed && <p className="font-body-sm text-body-sm text-on-surface-variant">마감된 Quiz는 재게시할 수 없어요. 기존 문항과 응시·보상 기록은 유지돼요.{quiz.closedAt && ` · ${formatDateTime(quiz.closedAt)} 마감`}</p>}
        <div className="flex flex-wrap gap-2">
          {publishable && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('publish', () => publishQuiz(quizId, revisionId), 'Quiz를 게시했어요. 팬이 풀 수 있어요.')}
              className={`${buttonClass} bg-primary text-on-primary`}
            >
              {busy === 'publish' ? '게시하는 중...' : quiz.publicationStatus === 'PUBLISHED' ? '이 revision으로 바꿔 게시' : '게시하기'}
            </button>
          )}
          {!blocked && quiz.publicationStatus === 'PUBLISHED' && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('unpublish', () => unpublishQuiz(quizId), '게시를 중지했어요.')}
              className={`${buttonClass} bg-surface-container text-on-surface`}
            >
              {busy === 'unpublish' ? '중지하는 중...' : '게시 중지'}
            </button>
          )}
          {!blocked && ['PUBLISHED', 'UNPUBLISHED'].includes(quiz.publicationStatus) && (
            <button type="button" disabled={busy !== null || judge.requesting} onClick={() => setConfirming('close')} className={`${buttonClass} bg-error-container text-on-error-container`}>마감하기</button>
          )}
        </div>
        {publicationPending && <ErrorBlock message="최신 Quiz 상태를 다시 확인해 주세요. 확인 전에는 변경할 수 없어요." onRetry={onChanged} />}
      </section>
      {confirming === 'close' && !closed && <CloseConfirmation busy={busy !== null} onClose={() => setConfirming(null)} onConfirm={() => run('close', () => closeQuiz(quizId), 'Quiz를 마감했어요.')} />}

      {/* revision 정보 */}
      <section className={sectionClass} aria-label="revision 정보">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            revision {data.revisionNo}
            {data.latest && <span className="ml-1 font-label-xs text-label-xs text-on-surface-variant">(최신)</span>}
          </span>
          <StatusPill label={review.label} icon={review.icon} tone={review.tone} />
        </div>
        <p className="font-label-xs text-label-xs text-on-surface-variant">
          {data.questions?.length ?? 0}문항 · {formatDateTime(data.createdAt)} 생성
          {data.decidedAt && ` · ${formatDateTime(data.decidedAt)} ${data.reviewStatus === 'APPROVED' ? '승인' : '반려'}`}
        </p>
        {data.reviewStatus === 'REJECTED' && data.decisionReason && (
          <p className="rounded-lg bg-surface-container p-space-sm font-body-sm text-body-sm text-on-surface">반려 사유: {data.decisionReason}</p>
        )}
        {data.videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(data.videoId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 self-start font-label-sm text-label-sm font-semibold text-primary"
          >
            <MaterialIcon name="smart_display" className="text-[18px]" />원본 영상 보기
          </a>
        )}
        {contentReview && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={contentReview.label} icon={contentReview.icon} tone={contentReview.tone} />
            {data.contentConfirmedAt && (
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {formatDateTime(data.contentConfirmedAt)} 원문 확정
              </span>
            )}
          </div>
        )}
        {data.contentText && (
          <details className="font-body-sm text-body-sm text-on-surface-variant">
            <summary className="cursor-pointer font-label-sm text-label-sm font-semibold text-on-surface">분석한 원문 텍스트</summary>
            <p className="mt-space-xs max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container p-space-sm">
              {data.contentText}
            </p>
          </details>
        )}
      </section>

      {data.contentLocked && <p className="rounded-xl bg-surface-container p-space-sm">최초 게시된 Quiz는 게시를 취소해도 읽기 전용이에요. 다른 내용은 새 Quiz로 생성해 주세요.</p>}
      {data === staleData && revision.error && <ErrorBlock message="최신 상태를 확인하지 못했어요. 이전 내용의 승인은 중단했습니다." onRetry={() => { revision.reload(); onChanged() }} />}
      {!blocked && data.canEdit === true && data.latest && data.contentLocked === false && (
        <button type="button" className={`${buttonClass} bg-primary text-on-primary`} disabled={busy !== null || data === staleData} onClick={() => setEditing(true)}>최종 문항 선택·편집</button>
      )}
      {composed && <p className="font-body-sm text-body-sm text-on-surface-variant">Creator 구성본이에요. 원본 Judge 결과는 참고용이며 최종 내용은 Creator가 책임 승인합니다.</p>}
      {/* GPT Judge */}
      {!composed && (action !== 'DECIDED' || evaluation) && (
        <JudgeSection judge={judge} evaluation={evaluation} action={action} readOnly={blocked || busy !== null} />
      )}

      {/* 승인·반려 */}
      {!blocked && data.reviewStatus === 'PENDING_REVIEW' && (
        <section className={sectionClass} aria-label="승인과 반려">
          <span className="font-label-md text-label-md font-semibold text-on-surface">검토 결정</span>
          {!approvable && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {composed ? '최신 구성본의 저장된 hash를 확인한 뒤 책임 승인할 수 있어요.' : evaluation?.status === 'SUCCEEDED'
                ? '기존 Judge 승인은 ALL_PASS가 필요해요. 최종 문항 구성에서는 미통과·보류 문항도 선택·수정할 수 있어요.'
                : 'GPT Judge 평가에서 모든 항목이 통과(ALL_PASS)해야 승인할 수 있어요.'}
            </p>
          )}
          {confirming === 'approve' && (
            <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container p-space-sm">
              {composed && <label className="flex gap-2"><input type="checkbox" checked={responsibleHash === data.revisionSha256} onChange={e => setResponsibleHash(e.target.checked ? data.revisionSha256 : null)} /> 최종 문항·정답·해설을 확인했고 게시 내용에 책임을 집니다.</label>}
              <p className="font-body-sm text-body-sm text-on-surface">승인하면 되돌릴 수 없어요. 승인한 뒤 게시할 수 있어요.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null || (composed && responsibleHash !== data.revisionSha256)}
                  onClick={() => run('approve', () => composed ? approveQuizByCreator(quizId, revisionId, data.revisionSha256) : approveQuizRevision(quizId, revisionId), '승인했어요. 이제 게시할 수 있어요.', { forgetJudge: true })}
                  className={`${buttonClass} bg-primary text-on-primary`}
                >
                  {busy === 'approve' ? '승인하는 중...' : '승인 확정'}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => setConfirming(null)} className={`${buttonClass} bg-surface-container-high text-on-surface`}>
                  취소
                </button>
              </div>
            </div>
          )}
          {confirming === 'reject' && (
            <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container p-space-sm">
              <label className="flex flex-col gap-space-xs">
                <span className="flex items-center justify-between font-label-sm text-label-sm font-semibold text-on-surface">
                  반려 사유 (선택)
                  <span className="font-label-xs text-label-xs font-normal text-on-surface-variant">
                    {reason.length}/{REJECT_REASON_MAX}
                  </span>
                </span>
                <textarea
                  value={reason}
                  maxLength={REJECT_REASON_MAX}
                  rows={3}
                  disabled={busy !== null}
                  onChange={(event) => setReason(event.target.value)}
                  className="rounded-lg bg-surface-container-lowest p-space-sm font-body-sm text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <p className="font-body-sm text-body-sm text-on-surface-variant">반려하면 되돌릴 수 없고 이 revision은 게시할 수 없어요.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('reject', () => rejectQuizRevision(quizId, revisionId, trimmedReason), '반려했어요.', { forgetJudge: true })}
                  className={`${buttonClass} bg-error text-on-error`}
                >
                  {busy === 'reject' ? '반려하는 중...' : '반려 확정'}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => setConfirming(null)} className={`${buttonClass} bg-surface-container-high text-on-surface`}>
                  취소
                </button>
              </div>
            </div>
          )}
          {confirming === null && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!approvable || busy !== null}
                onClick={() => setConfirming('approve')}
                className={`${buttonClass} bg-primary text-on-primary`}
              >
                {composed ? 'Creator 책임 승인' : '승인'}
              </button>
              <button
                type="button"
                disabled={busy !== null || judge.requesting}
                onClick={() => setConfirming('reject')}
                className={`${buttonClass} bg-surface-container text-on-surface`}
              >
                반려
              </button>
            </div>
          )}
        </section>
      )}

      {/* 문항 */}
      {(data.questions ?? []).map((question) => (
        <div key={question.questionId ?? question.questionNo}>
          {question.evaluationStatus && <p className="font-label-sm text-label-sm text-on-surface-variant">{({ PASS: 'AI 원본 통과', FAIL: 'AI 원본 미통과', UNCERTAIN: 'AI 원본 판단 보류', NOT_REVALIDATED: '수정 문항 · 재검증 안 됨', NOT_EVALUATED: '평가 없음' })[question.evaluationStatus]}</p>}
          <QuestionReview question={question} judged={composed ? null : judgedByNo.get(question.questionNo)} />
          {question.sourceEvaluation && (composed || !judgedByNo.has(question.questionNo)) && <details className={sectionClass}><summary>AI 원본 참고 평가 (현재 수정 문항의 검증 결과가 아닙니다)</summary>{Object.entries(question.sourceEvaluation.items).map(([name, item]) => <p key={name}>{JUDGE_ITEMS.find(([field]) => field === name)?.[1] ?? name}: {VERDICTS[item.verdict]?.label ?? item.verdict} · {item.reason}</p>)}</details>}
        </div>
      ))}
    </div>
  )
}

function CloseConfirmation({ busy, onClose, onConfirm }) {
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  useEffect(() => { if (busy) dialog.current?.focus() }, [busy])
  function handleKey(event) {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose() }
    if (event.key === 'Tab') {
      const buttons = [...dialog.current.querySelectorAll('button:not(:disabled)')]
      const next = buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1)
      event.preventDefault()
      buttons[(next + buttons.length) % buttons.length]?.focus()
    }
  }
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label="Quiz를 마감할까요?" tabIndex={-1} onKeyDown={handleKey}>
    <ConfirmSheet open title="Quiz를 마감할까요?" message="마감 후에는 재게시할 수 없어요. 팬의 신규 응시는 차단되며, 기존 응시 기록과 보상은 유지돼요." confirmLabel="마감 확정" busy={busy} onClose={onClose} onConfirm={onConfirm} />
  </div>
}

function JudgeSection({ judge, evaluation, action, readOnly = false }) {
  const aggregation = evaluation?.status === 'SUCCEEDED' ? AGGREGATION_LABELS[evaluation.aggregation] : null
  const failed = evaluation && (evaluation.status === 'FAILED' || evaluation.status === 'UNKNOWN')
  const canRequest = !readOnly && !judge.checking
    && (action === 'REQUEST' || action === 'RETRY' || (judge.unconfirmed && action !== 'DECIDED' && action !== 'DONE'))

  return (
    <section className={sectionClass} aria-label="GPT Judge 평가">
      <div className="flex items-center justify-between gap-2">
        <span className="font-label-md text-label-md font-semibold text-on-surface">GPT Judge 평가</span>
        {aggregation && <StatusPill label={aggregation.label} icon={aggregation.icon} tone={aggregation.tone} />}
        {!aggregation && evaluation && (
          <StatusPill
            label={JUDGE_LABELS[evaluation.status] ?? evaluation.status}
            icon={failed ? 'error' : 'hourglass_top'}
            tone={failed ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface'}
          />
        )}
      </div>

      {judge.checking && !judge.pollStopped && (
        <div className="flex items-center gap-2 text-on-surface-variant" role="status">
          <Spinner className="h-4 w-4 text-primary" />
          <p className="font-body-sm text-body-sm">평가 상태를 확인하는 중...</p>
        </div>
      )}
      {!evaluation && !judge.unconfirmed && !judge.checking && action === 'REQUEST' && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          문항마다 7개 항목을 평가해요. AI 유료 호출이며 revision당 최대 2회까지 요청할 수 있어요.
        </p>
      )}
      {judge.unconfirmed && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          평가 요청 결과를 확인하지 못했어요. 다시 확인하면 같은 요청으로 이어서 처리해요.
        </p>
      )}
      {evaluation && isActiveJob(evaluation) && !judge.pollStopped && (
        <div className="flex items-center gap-2 text-on-surface-variant" role="status">
          <Spinner className="h-4 w-4 text-primary" />
          <p className="font-body-sm text-body-sm">
            평가하고 있어요({evaluation.attempt}/{evaluation.maxAttempts}회차). 화면을 닫아도 이어서 진행돼요.
          </p>
        </div>
      )}
      {judge.pollStopped && (
        <div className="flex items-center justify-between gap-2">
          <p className="font-body-sm text-body-sm text-on-surface-variant">평가 상태를 확인하지 못했어요.</p>
          <button type="button" onClick={judge.retryPoll} className={`${buttonClass} bg-surface-container text-on-surface`}>
            다시 확인
          </button>
        </div>
      )}
      {aggregation && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {evaluation.aggregation === 'ALL_PASS'
            ? `모든 문항의 7개 항목이 통과했어요.${action === 'DONE' ? ' 승인할 수 있어요.' : ''}`
            : '미통과·보류 항목은 아래 문항별 결과에서 확인할 수 있어요.'}
        </p>
      )}
      {failed && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {judgeFailureMessage(evaluation)} ({evaluation.attempt}/{evaluation.maxAttempts}회 사용)
          {action === 'EXHAUSTED' && ' 평가 횟수를 모두 사용했어요. 이 revision은 반려할 수 있어요.'}
          {action === 'RETRY' && evaluation.status === 'UNKNOWN' && ' 이전 평가가 실제로 끝났을 수 있어 다시 평가하면 비용이 중복될 수 있어요.'}
        </p>
      )}
      {judge.notice && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {judge.notice}
        </p>
      )}
      {canRequest && (
        <button
          type="button"
          disabled={judge.requesting}
          onClick={judge.request}
          className={`${buttonClass} self-start bg-primary text-on-primary`}
        >
          {judge.requesting ? '요청하는 중...' : judge.unconfirmed ? '평가 요청 다시 확인' : action === 'RETRY' ? '다시 평가 요청' : '평가 요청'}
        </button>
      )}
    </section>
  )
}

function QuestionReview({ question, judged }) {
  const items = judged ? JUDGE_ITEMS.map(([key, label]) => ({ key, label, ...(judged.items?.[key] ?? {}) })) : []
  const notPassed = items.filter((item) => item.verdict !== 'pass')

  return (
    <article className="flex flex-col gap-space-xs">
      <p className="font-label-md text-label-md font-semibold text-on-surface">
        {question.questionNo + 1}. {question.question}
      </p>
      {question.options.map((option) => {
        const correct = option.optionNo === question.correctOptionIndex
        return (
          <div
            key={option.optionNo}
            className={`flex items-center gap-space-sm rounded-xl px-space-md py-3 ${
              correct ? 'bg-primary/10 text-on-surface' : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            <MaterialIcon
              name={correct ? 'check_circle' : 'radio_button_unchecked'}
              className={`text-[20px] ${correct ? 'text-primary' : 'text-outline'}`}
            />
            <span className="flex-1 font-body-sm text-body-sm">{option.text}</span>
            {correct && <span className="font-label-xs text-label-xs font-semibold text-primary">정답</span>}
          </div>
        )
      })}
      {question.explanation && (
        <p className="rounded-xl bg-surface-container p-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">해설 </span>
          {question.explanation}
        </p>
      )}
      {question.sourceEvidence && (
        <p className="rounded-xl bg-surface-container p-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">근거 </span>
          {question.sourceEvidence}
        </p>
      )}
      {judged && (
        <details className="rounded-xl bg-surface-container-low p-space-sm" open={notPassed.length > 0}>
          <summary className="cursor-pointer font-label-sm text-label-sm font-semibold text-on-surface">
            {notPassed.length === 0 ? 'GPT Judge 7개 항목 모두 통과' : `GPT Judge 미통과·보류 ${notPassed.length}개 항목`}
          </summary>
          <ul className="mt-space-xs flex flex-col gap-space-xs">
            {items.map((item) => {
              const verdict = VERDICTS[item.verdict] ?? VERDICTS.uncertain
              return (
                <li key={item.key} className="flex items-start gap-space-xs">
                  <MaterialIcon name={verdict.icon} className={`mt-0.5 text-[18px] ${verdict.className}`} />
                  <span className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
                    <span className="font-semibold text-on-surface">{item.label}</span> · {verdict.label}
                    {item.reason && <span className="block break-words">{item.reason}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </article>
  )
}
