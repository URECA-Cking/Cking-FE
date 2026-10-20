import { useCallback, useEffect, useRef, useState } from 'react'
import QuizContentReviewSheet from './QuizContentReviewSheet.jsx'
import { isAwaitingContentReview, clearReviewDraft } from '../../utils/quizContentReview.js'
import BottomSheet from '../ui/BottomSheet.jsx'
import CreateFab from '../ui/CreateFab.jsx'
import { Spinner, StatusPill } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { newRequestId } from '../../api/client.js'
import { getCurrentQuizGeneration, cancelQuizGeneration, getQuizGeneration, requestQuizGeneration } from '../../api/creatorQuizzes.js'
import {
  QUESTION_COUNTS,
  QUIZ_TITLE_MAX,
  browserStorage,
  creatorQuizErrorMessage,
  generationFailureMessage,
  generationInput,
  generationRequestFor,
  generationStartBlock,
  isActiveJob,
  isUncertainError,
  pollDelay,
  quizJobsKey,
  readQuizJobs,
  readQuizJobsChecked,
  updateQuizJobsLocked,
  validateGenerationInput,
  withGenerationIf,
  withGenerationPost,
  withGenerationPostFailure,
} from '../../utils/quizJobs.js'

// 상태 조회가 이 횟수만큼 연달아 실패하면 자동 조회를 멈추고 "다시 확인"을 보여준다.
const POLL_FAILURE_MAX = 3

const GENERATION_LABELS = {
  PENDING: '생성 대기 중',
  RUNNING: '생성 중',
  SUCCEEDED: '생성 완료',
  FAILED: '생성 실패',
  UNKNOWN: '결과 확인 불가',
}

const EMPTY_FORM = { youtubeUrl: '', title: '', questionCount: 3 }

const cardClass = 'flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md'
const smallButtonClass =
  'rounded-xl px-4 py-2 font-label-sm text-label-sm font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

/**
 * 내 Quiz 탭의 AI Quiz 생성. YouTube URL·제목·문항 수로 생성을 요청하고(POST /api/creator/quizzes/generations),
 * 생성 작업을 조회한다(GET .../generations/{generationId}). 요청 정보는 Creator별로 브라우저에 저장해
 * 새로고침 뒤에도 이어서 조회하고, 응답을 받지 못한 요청은 같은 입력이면 같은 requestId로 다시 보낸다.
 * Creator당 진행 중인 생성은 하나라서 진행 중에는 새로 요청하지 않는다. 결과를 확인하지 못한 요청은 접수됐을 수 있어
 * 확인되기 전에는 지우거나 다른 입력으로 새로 요청하지 않는다.
 *
 * 같은 Creator 화면을 여러 탭에서 열면 storage 이벤트로 다른 탭의 저장값을 반영하고, 요청 직전에 저장소를 다시 읽는다.
 * 저장 변경은 Creator별 Web Lock 안에서 requestId를 비교한다. 잠금·저장을 확인하지 못하면 새 유료 요청을 보내지 않는다.
 */
export default function QuizGenerationPanel(props) {
  return <GenerationSession key={props.creatorId} {...props} />
}
function GenerationSession({ creatorId, onSucceeded, onReview }) {
  const showToast = useToast()
  const storage = browserStorage()
  // 저장된 생성 요청 { requestId, input, generationId, savedAt }. 작업 ID가 없으면 응답을 받지 못한 요청이다.
  const [stored, setStored] = useState(() => readQuizJobs(storage, creatorId, Date.now()).generation)
  const [recovered, setRecovered] = useState(null)
  const [recovering, setRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState(null)
  const [reviewDrafts] = useState(() => new Map())
  const [reviewJob, setReviewJob] = useState(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const reviewInFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [job, setJob] = useState(null)
  const [succeeded, setSucceeded] = useState(null)
  const [polls, setPolls] = useState(0)
  const [pollFailures, setPollFailures] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(() => stored?.input ?? EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // 연타로 같은 요청이 겹쳐 나가지 않게 한다(상태 값은 다음 렌더 전까지 바뀌지 않는다).
  const submitInFlight = useRef(false)
  const onSucceededRef = useRef(onSucceeded)
  useEffect(() => {
    onSucceededRef.current = onSucceeded
  }, [onSucceeded])
  const storedRef = useRef(stored)
  useEffect(() => {
    storedRef.current = stored
  }, [stored])

  const generationId = stored?.generationId ?? recovered?.generationId ?? null
  const generationRef = useRef(generationId)
  useEffect(() => { generationRef.current = generationId }, [generationId])
  const storedRequestId = stored?.requestId ?? null
  const currentJob = job && job.generationId === generationId ? job : null
  // 저장된 작업의 상태를 아직 모르거나 진행 중이면 조회한다.
  const tracking = generationId !== null && (currentJob === null || (isActiveJob(currentJob) && !isAwaitingContentReview(currentJob)))
  const pollStopped = pollFailures >= POLL_FAILURE_MAX
  // 결과를 확인하지 못한 요청이 있거나, 진행 중이거나 상태를 아직 모르는 작업이 있으면 새 생성을 막는다.
  const canStart = !submitting && !recovering && !recoveryError && !reviewBusy && ((stored === null && recovered === null) || (generationId !== null && currentJob !== null && !isActiveJob(currentJob)))

  const clearDraft = useCallback(id => {
    reviewDrafts.delete(id)
    clearReviewDraft(storage, creatorId, id)
  }, [storage, creatorId, reviewDrafts])

  const update = useCallback(async (updater, memoryOnFailure = false) => {
    const changed = await updateQuizJobsLocked(storage, creatorId, updater, Date.now())
    if (changed.ok) {
      storedRef.current = changed.jobs.generation
      setStored(changed.jobs.generation)
    } else if (memoryOnFailure) {
      const current = { generation: storedRef.current, judges: {} }
      const next = updater(current)
      changed.applied = next !== current
      storedRef.current = next.generation
      setStored(next.generation)
    }
    return changed
  }, [storage, creatorId])

  const completeGeneration = useCallback(async (latest, requestId) => {
    if (!alive.current || generationRef.current !== latest.generationId) return
    if (requestId !== null && !(await update(withGenerationIf(requestId, null), true)).applied) return
    if (!alive.current || (generationRef.current !== null && generationRef.current !== latest.generationId)) return
    clearDraft(latest.generationId)
    setReviewJob(null)
    setRecovered(null)
    setSucceeded(latest)
    showToast('Quiz를 만들었어요. 문항을 검토해 주세요.')
    onSucceededRef.current?.(latest)
  }, [update, clearDraft, showToast])

  const recoverCurrent = useCallback(async (terminalRequest = null) => {
    const before = storedRef.current
    setRecovering(true)
    try {
      const active = await getCurrentQuizGeneration()
      if (!alive.current) return
      setRecoveryError(null)
      // 저장된 요청이 생겼다면 응답으로 다른 작업을 덮어쓰지 않는다.
      const latestStored = storedRef.current
      if (latestStored?.generationId != null) {
        if (!terminalRequest || latestStored.requestId !== terminalRequest.requestId || latestStored.generationId !== terminalRequest.generationId) return
        if (!(await update(withGenerationIf(terminalRequest.requestId, null), true)).applied || storedRef.current !== null) return
      } else if (latestStored?.requestId !== before?.requestId) return
      if (Number.isSafeInteger(active?.generationId) && isActiveJob(active)) {
        setRecovered(active); setJob(active); setPolls(0); setPollFailures(0)
      }
    } catch (error) {
      if (alive.current) setRecoveryError(creatorQuizErrorMessage(error, '진행 중인 작업을 확인하지 못했어요.'))
    } finally { if (alive.current) setRecovering(false) }
  }, [update])
  useEffect(() => {
    if (storedRef.current === null) recoverCurrent()
  }, [recoverCurrent])

  // 다른 탭이 이 Creator의 저장값을 바꾸면 반영한다(storage 이벤트는 바꾼 탭이 아닌 다른 탭에만 온다).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const key = quizJobsKey(creatorId)
    function handleStorage(event) {
      if (event.key !== null && event.key !== key) return
      const snapshot = readQuizJobsChecked(storage, creatorId, Date.now())
      if (!snapshot.ok) return
      const latest = snapshot.jobs.generation
      const before = storedRef.current
      storedRef.current = latest
      setStored(latest)
      // 다른 탭이 이 화면이 보던 작업을 끝내 지웠으면(완료 등) 목록을 다시 불러온다.
      if (before?.generationId != null && before.generationId !== latest?.generationId) onSucceededRef.current?.()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storage, creatorId])

  useEffect(() => {
    if (!tracking || pollStopped) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const latest = await getQuizGeneration(generationId)
        if (cancelled) return
        setPollFailures(0)
        setJob(latest)
        if (!isActiveJob(latest)) clearDraft(generationId)
        if (latest.status === 'SUCCEEDED') {
          await completeGeneration(latest, storedRequestId)
        }
      } catch (error) {
        if (cancelled) return
        if (error?.status === 404 || error?.status === 403) {
          // 이 계정의 작업이 아니거나 없는 작업이다. 다시 조회해도 바뀌지 않으므로 저장값을 지운다.
          if (storedRequestId !== null) await update(withGenerationIf(storedRequestId, null), true)
          clearDraft(generationId)
          setRecovered(null); setJob(null); setReviewJob(null)
          showToast(creatorQuizErrorMessage(error, '생성 작업을 찾을 수 없어요.'), { icon: 'error' })
        } else {
          setPollFailures((count) => count + 1)
        }
      } finally {
        if (!cancelled) setPolls((count) => count + 1)
      }
    }, currentJob ? pollDelay(polls) : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tracking, pollStopped, generationId, storedRequestId, currentJob, polls, storage, creatorId, showToast, update, clearDraft, completeGeneration])

  function openForm(input) {
    setForm(input ?? stored?.input ?? EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  async function submit(source) {
    if (submitInFlight.current || (recovered && (currentJob === null || isActiveJob(currentJob)))) return
    const input = generationInput(source)
    const invalid = validateGenerationInput(input)
    if (invalid) {
      setFormError(invalid)
      return
    }
    // 다른 탭이 그 사이 요청을 시작했을 수 있어 화면 상태가 아니라 저장소의 최신 값으로 판단한다.
    const snapshot = readQuizJobsChecked(storage, creatorId, Date.now())
    const previous = snapshot.ok ? snapshot.jobs.generation : storedRef.current
    storedRef.current = previous
    setStored(previous)
    const block = generationStartBlock(previous, input, job)
    if (block === 'ACTIVE') {
      setFormError('진행 중이거나 상태를 확인하고 있는 Quiz 생성이 있어요. 끝난 뒤 다시 요청해 주세요.')
      return
    }
    if (block === 'UNCONFIRMED') {
      setFormError('결과를 확인하지 못한 생성 요청이 있어요. 중복 생성을 막기 위해 그 요청을 먼저 다시 확인해 주세요.')
      return
    }
    // 같은 입력의 미확인 요청이면 그 요청(같은 requestId)을 그대로 다시 보낸다.
    const request = generationRequestFor(previous, input, newRequestId, Date.now())
    const replaying = request === previous
    const postId = newRequestId()
    // 보내기 전에 저장해 둔다. 응답 전에 새로고침해도 같은 requestId로 다시 확인할 수 있다.
    submitInFlight.current = true
    setSubmitting(true)
    {
      const reserved = await update(replaying
        ? withGenerationPost(request.requestId, request.generationId, postId)
        : withGenerationIf(previous?.requestId ?? null, { ...request, pendingPosts: { [postId]: 'WAITING' } }), replaying)
      if (!reserved.applied || (!replaying && !reserved.ok)) {
        submitInFlight.current = false
        setSubmitting(false)
        setFormError('요청 정보를 안전하게 저장하지 못했어요. 저장소 상태나 다른 탭의 작업을 확인한 뒤 다시 시도해 주세요.')
        return
      }
    }
    setFormError(null)
    try {
      const created = await requestQuizGeneration({ requestId: request.requestId, ...input })
      // 이전 요청의 늦은 응답은 다른 탭의 최신 요청을 교체하지 않는다.
      if (!(await update(withGenerationIf(request.requestId, { ...request, generationId: created.generationId, pendingPosts: {} }), true)).applied) return
      setRecovered(null)
      setSucceeded(null)
      setPolls(0)
      setPollFailures(0)
      setFormOpen(false)
      if (created.status === 'SUCCEEDED') {
        // 이미 끝난 작업의 재요청이면 완료 처리는 조회 effect가 한다.
        setJob(null)
      } else {
        setJob(created)
        showToast('Quiz 생성을 요청했어요. 완료되면 알려 드릴게요.')
      }
    } catch (error) {
      if (error?.code === 'QUIZ_GENERATION_IN_PROGRESS') {
        await update(withGenerationPostFailure(request.requestId, postId, error, replaying ? null : previous), true)
        await recoverCurrent(previous?.generationId === job?.generationId && job && !isActiveJob(job) ? previous : null)
        setFormOpen(false)
        return
      }
      // Web Lock 안에서 개별 시도를 정리한다. 다른 시도의 성공/대기 상태는 실패한 이 POST와 구분한다.
      await update(withGenerationPostFailure(request.requestId, postId, error, replaying ? null : previous), true)
      if (isUncertainError(error)) {
        // 처리됐는지 알 수 없다. 요청을 유지해 같은 입력으로 다시 보내면 같은 requestId를 쓴다.
        setFormError('요청 결과를 확인하지 못했어요. 같은 내용으로 다시 요청하면 중복 없이 이어서 확인해요.')
        setFormOpen(true)
      } else {
        // 400·401·403 등은 공유 UUID의 전체 접수 여부를 알려 주지 않으므로 요청을 보존한다.
        setFormError(creatorQuizErrorMessage(error, 'Quiz 생성을 요청하지 못했어요.'))
        setFormOpen(true)
      }
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  // 실패·결과 확인 불가로 끝난 작업 카드만 닫는다. 결과를 확인하지 못한 요청은 지우지 않는다.
  async function dismiss() {
    await update(withGenerationIf(storedRequestId, null))
    setRecovered(null)
    setJob(null)
    setSucceeded(null)
  }

  async function refreshReview() {
    const id = generationId
    let latest
    try { latest = await getQuizGeneration(id) }
    catch (error) {
      if (![403,404].includes(error?.status)) throw error
      if (!alive.current || generationRef.current !== id) return
      clearDraft(id); setReviewJob(null); setRecovered(null); setJob(null)
      if (storedRequestId) await update(withGenerationIf(storedRequestId,null),true)
      setRecoveryError(creatorQuizErrorMessage(error,'작업에 접근할 수 없어요.'))
      return
    }
    if (!alive.current || generationRef.current !== id) return
    setJob(latest); setPolls(0); setPollFailures(0)
    if (!isAwaitingContentReview(latest)) {
      clearDraft(id); setReviewJob(null)
      if (latest.status === 'SUCCEEDED') {
        await completeGeneration(latest, storedRequestId)
      }
    }
  }
  async function openReview() {
    if (reviewInFlight.current) return
    const id = generationId
    reviewInFlight.current = true; setReviewBusy(true); setRecoveryError(null)
    try {
      const latest = await getCurrentQuizGeneration()
      if (!alive.current || generationRef.current !== id) return
      if (latest?.generationId === id && isAwaitingContentReview(latest) && latest.content) setReviewJob(latest)
      else await refreshReview()
    } catch (error) {
      if ([403,404].includes(error?.status) && alive.current && generationRef.current === id) {
        clearDraft(id); setRecovered(null); setJob(null); setReviewJob(null)
        if (storedRequestId) await update(withGenerationIf(storedRequestId,null),true)
      }
      if (alive.current) setRecoveryError(creatorQuizErrorMessage(error, '원문을 불러오지 못했어요.'))
    } finally { reviewInFlight.current = false; if (alive.current) setReviewBusy(false) }
  }
  async function acceptReviewResult(result, expectedId) {
    if (!alive.current || generationRef.current !== expectedId || result?.generationId !== expectedId) return
    clearDraft(expectedId)
    setReviewJob(null); setJob(result); setPolls(0); setPollFailures(0)
    if (result.status === 'SUCCEEDED') await completeGeneration(result, storedRequestId)
  }
  async function cancelReviewCard() {
    if (reviewInFlight.current) return
    const id = generationId
    reviewInFlight.current = true; setReviewBusy(true)
    try { await acceptReviewResult(await cancelQuizGeneration(id), id) }
    catch (error) {
      if (!alive.current || generationRef.current !== id) return
      if ([403,404].includes(error?.status)) { clearDraft(id); setRecovered(null); setReviewJob(null); if(storedRequestId) await update(withGenerationIf(storedRequestId,null),true) }
      else if (error?.status === 409) { try { await refreshReview() } catch { /* 아래 안내 후 재조회할 수 있다. */ } }
      setRecoveryError(creatorQuizErrorMessage(error, '취소 결과를 확인하지 못했어요. 다시 취소할 수 있어요.'))
    } finally { reviewInFlight.current=false; if(alive.current) setReviewBusy(false) }
  }
  const awaitingReview = isAwaitingContentReview(currentJob)
  const displayInput = recovered ?? stored?.input ?? currentJob ?? EMPTY_FORM
  const failed = currentJob && (currentJob.status === 'FAILED' || currentJob.status === 'UNKNOWN')

  return (
    <div className="flex flex-col gap-space-sm">
      <CreateFab label="AI Quiz 만들기" onClick={() => openForm(EMPTY_FORM)} disabled={!canStart} />

      {recoveryError && <div role="alert"><p>{recoveryError}</p><button onClick={() => generationId ? openReview() : recoverCurrent()}>다시 확인</button></div>}
      {reviewJob?.generationId === generationId && <QuizContentReviewSheet key={reviewJob.generationId} creatorId={creatorId} job={reviewJob} storage={storage} drafts={reviewDrafts}
        onClose={() => setReviewJob(null)} onResult={result => acceptReviewResult(result, reviewJob.generationId)}
        onRefresh={refreshReview} onInaccessible={async error => {
          if (!alive.current || generationRef.current !== reviewJob.generationId) return
          clearDraft(reviewJob.generationId)
          setReviewJob(null); setRecovered(null); setJob(null)
          if (storedRequestId) await update(withGenerationIf(storedRequestId,null),true)
          setRecoveryError(creatorQuizErrorMessage(error,'작업에 접근할 수 없어요.'))
        }} />}
      {stored && generationId === null && !formOpen && (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-label-md text-label-md font-semibold text-on-surface">{displayInput.title}</span>
            <StatusPill label="요청 확인 필요" icon="help" />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            생성 요청이 접수됐는지 확인하지 못했어요. 다시 확인하면 같은 요청으로 보내 중복 생성 없이 이어서 처리해요.
            확인하기 전에는 새 Quiz를 만들 수 없어요.
          </p>
          <button
            type="button"
            onClick={() => submit(stored.input)}
            disabled={submitting}
            className={`${smallButtonClass} self-start bg-primary text-on-primary`}
          >
            {submitting ? '확인하는 중...' : '다시 확인'}
          </button>
        </div>
      )}

      {generationId !== null && !failed && (
        <div className={cardClass} role="status">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-label-md text-label-md font-semibold text-on-surface">{displayInput.title}</span>
            <StatusPill
              label={awaitingReview ? '원문 검토 대기' : currentJob?.reviewStage === 'GROUNDING' ? '영상 분석 중' : currentJob?.reviewStage === 'GENERATING' ? '문항 생성 중' : currentJob ? GENERATION_LABELS[currentJob.status] ?? currentJob.status : '상태 확인 중'}
              icon="hourglass_top"
              tone="bg-surface-container-high text-on-surface"
            />
          </div>
          {awaitingReview ? <div className="flex flex-col gap-2">
            <p>AI가 분석한 원문을 확인하면 문항 생성을 시작해요.</p>
            <button disabled={reviewBusy} onClick={openReview} className={`${smallButtonClass} bg-primary text-on-primary`}>원문 검토하기</button>
            <button disabled={reviewBusy} onClick={cancelReviewCard} className={smallButtonClass}>생성 취소</button>
          </div> : pollStopped ? (
            <div className="flex items-center justify-between gap-2">
              <p className="font-body-sm text-body-sm text-on-surface-variant">생성 상태를 확인하지 못했어요.</p>
              <button type="button" onClick={() => setPollFailures(0)} className={`${smallButtonClass} bg-surface-container text-on-surface`}>
                다시 확인
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Spinner className="h-4 w-4 text-primary" />
              <p className="font-body-sm text-body-sm">
                영상을 분석해 {displayInput.questionCount}문항을 만들고 있어요. 화면을 닫아도 이어서 진행돼요.
              </p>
            </div>
          )}
        </div>
      )}

      {failed && (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-label-md text-label-md font-semibold text-on-surface">{displayInput.title}</span>
            <StatusPill label={GENERATION_LABELS[currentJob.status]} icon="error" tone="bg-error-container text-on-error-container" />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {generationFailureMessage(currentJob)} 다시 만들면 새 요청으로 처리돼요.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => openForm(displayInput)} className={`${smallButtonClass} bg-primary text-on-primary`}>
              다시 만들기
            </button>
            <button type="button" onClick={dismiss} className={`${smallButtonClass} bg-surface-container text-on-surface`}>
              닫기
            </button>
          </div>
        </div>
      )}

      {succeeded && !stored && (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-label-md text-label-md font-semibold text-on-surface">{succeeded.title}</span>
            <StatusPill label="생성 완료" icon="check_circle" tone="bg-primary text-on-primary" />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            문항을 검토하고 GPT Judge 평가를 거쳐 승인하면 게시할 수 있어요.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onReview?.(succeeded)} className={`${smallButtonClass} bg-primary text-on-primary`}>
              검토하기
            </button>
            <button type="button" onClick={() => setSucceeded(null)} className={`${smallButtonClass} bg-surface-container text-on-surface`}>
              닫기
            </button>
          </div>
        </div>
      )}

      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title="AI Quiz 만들기" eyebrow="Quiz">
        <form
          className="flex flex-col gap-space-md"
          onSubmit={(event) => {
            event.preventDefault()
            submit(form)
          }}
        >
          <label className="flex flex-col gap-space-xs">
            <span className="font-label-md text-label-md font-semibold text-on-surface">YouTube 영상 주소</span>
            <input
              type="url"
              inputMode="url"
              value={form.youtubeUrl}
              onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))}
              placeholder="https://youtu.be/..."
              disabled={submitting}
              className="h-12 rounded-xl bg-surface-container-low px-space-md font-body-sm text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="font-label-xs text-label-xs text-on-surface-variant">공개 영상만 분석할 수 있어요.</span>
          </label>
          <label className="flex flex-col gap-space-xs">
            <span className="flex items-center justify-between font-label-md text-label-md font-semibold text-on-surface">
              Quiz 제목
              <span className="font-label-xs text-label-xs font-normal text-on-surface-variant">
                {form.title.length}/{QUIZ_TITLE_MAX}
              </span>
            </span>
            <input
              type="text"
              value={form.title}
              maxLength={QUIZ_TITLE_MAX}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              disabled={submitting}
              className="h-12 rounded-xl bg-surface-container-low px-space-md font-body-sm text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <fieldset className="flex flex-col gap-space-xs">
            <legend className="mb-space-xs font-label-md text-label-md font-semibold text-on-surface">문항 수</legend>
            <div className="grid grid-cols-2 gap-2">
              {QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={form.questionCount === count}
                  disabled={submitting}
                  onClick={() => setForm((current) => ({ ...current, questionCount: count }))}
                  className={`h-11 rounded-xl font-label-md text-label-md font-semibold transition-all active:scale-[0.98] ${
                    form.questionCount === count ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'
                  }`}
                >
                  {count}문항
                </button>
              ))}
            </div>
          </fieldset>
          <p className="rounded-xl bg-surface-container-low p-space-sm font-body-sm text-body-sm text-on-surface-variant">
            AI가 영상을 분석해 4지선다 문항을 만들어요. 생성은 한 번에 하나만 진행할 수 있고, 만든 뒤에는 검토·평가·승인을 거쳐 게시해요.
          </p>
          {formError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary py-3 text-on-primary font-label-md text-label-md font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? '요청하는 중...' : '만들기'}
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}
