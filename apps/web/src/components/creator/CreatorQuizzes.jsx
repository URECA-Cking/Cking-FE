import { useCallback, useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { describeError, newRequestId } from '../../api/client.js'
import { getCreatorQuiz, getCreatorQuizzes, getMyQuizAttempt, submitQuizAttempt } from '../../api/quizzes.js'
import { formatDateTime } from '../../utils/format.js'
import {
  QUIZ_PAGE_SIZE,
  appendQuizPage,
  classifySubmitError,
  clearQuizProgress,
  quizListView,
  quizProgressKey,
  quizStep,
  readQuizProgress,
  restoreQuizAnswers,
  resumeStep,
  saveQuizProgress,
  submitRequestFor,
} from '../../utils/fanQuiz.js'
import { browserStorage } from '../../utils/quizJobs.js'

// 지급 처리 중(PENDING)이면 이 간격으로 이 횟수만큼만 다시 조회한다. 그 뒤에는 사용자가 직접 다시 확인한다.
const PAYMENT_POLL_INTERVAL_MS = 3000
const PAYMENT_POLL_MAX = 5
// 보기를 고른 뒤 다음 문항으로 넘어가기 전에 선택 표시를 보여주는 시간.
const ADVANCE_DELAY_MS = 250

// reward.paymentStatus 표시. PAID만 지급 완료다. reward.status(저장 당시 값)는 지급 판단에 쓰지 않는다.
const PAYMENT_LABELS = {
  NOT_ELIGIBLE: { label: '지급 대상 아님', icon: 'block', tone: 'bg-surface-container text-on-surface-variant' },
  PENDING: { label: '지급 처리 중', icon: 'hourglass_top', tone: 'bg-surface-container-high text-on-surface' },
  PAID: { label: '지급 완료', icon: 'check_circle', tone: 'bg-primary text-on-primary' },
  DELAYED: { label: '지급 확인 지연', icon: 'schedule', tone: 'bg-surface-container-high text-on-surface' },
  UNAVAILABLE: { label: '상태 확인 불가', icon: 'help', tone: 'bg-surface-container text-on-surface-variant' },
}

function paymentMessage(reward) {
  switch (reward?.paymentStatus) {
    case 'NOT_ELIGIBLE':
      return '맞힌 문제가 없어 응모권이 지급되지 않아요.'
    case 'PAID':
      return `응모권 ${reward.amount}장이 지급됐어요.`
    case 'PENDING':
      return `응모권 ${reward.amount}장을 지급하고 있어요.`
    case 'DELAYED':
      return '지급 확인이 늦어지고 있어요. 잠시 후 다시 확인해 주세요.'
    default:
      return '지급 상태를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.'
  }
}

/**
 * Creator Space의 Quiz 탭(Fan 응시). 게시 Quiz 목록·상세는 공개 조회, 제출·내 결과는 로그인이 필요하다.
 * 회원당 Quiz 응시는 한 번이며, 이미 푼 Quiz는 저장된 결과를 보여준다. 정답 1개당 이 크리에이터 응모권 1장이 지급된다.
 */
export default function CreatorQuizzes({ creatorId, memberId = null, authenticated, sessionLoading, isMine, onLogin, onRewardPaid }) {
  const [openQuizId, setOpenQuizId] = useState(null)
  // 지급 완료를 확인한 응시는 잔액을 한 번만 다시 불러온다(시트를 다시 열 때마다 반복하지 않는다).
  const refreshedAttempts = useRef(new Set())
  const handleRewardPaid = useCallback((attemptId) => {
    if (refreshedAttempts.current.has(attemptId)) return
    refreshedAttempts.current.add(attemptId)
    onRewardPaid?.()
  }, [onRewardPaid])
  const { data, loading, error, reload } = useAsync(
    () => getCreatorQuizzes(creatorId, { page: 0, size: QUIZ_PAGE_SIZE }),
    [creatorId],
    { fallbackMessage: 'Quiz 목록을 불러오지 못했어요.' },
  )
  // "더 보기"로 이어 읽은 페이지. 첫 페이지를 다시 읽거나 Creator가 바뀌면(data가 바뀌면) quizListView가 버린다.
  const [more, setMore] = useState(null)
  const [moreLoading, setMoreLoading] = useState(false)
  // 다음 페이지 오류도 어느 첫 페이지에서 난 것인지 함께 둔다. 첫 페이지가 바뀌면 이전 오류는 보이지 않는다.
  const [moreFailure, setMoreFailure] = useState(null)
  const moreError = moreFailure && moreFailure.base === data ? moreFailure.message : null
  const moreInFlight = useRef(false)
  const { items: quizzes, hasNext, nextPage } = quizListView(data, more)
  // 요청 도중 첫 페이지가 바뀌었는지 응답 시점에 확인하려고 최신 data를 ref로 둔다.
  const latestData = useRef(data)
  useEffect(() => {
    latestData.current = data
  }, [data])

  async function loadMore() {
    // 같은 페이지를 겹쳐 요청하지 않는다. 실패하면 목록은 그대로 두고 같은 페이지를 다시 요청할 수 있다.
    if (moreInFlight.current || !data || !hasNext) return
    moreInFlight.current = true
    const base = data
    const page = nextPage
    setMoreLoading(true)
    setMoreFailure(null)
    try {
      const response = await getCreatorQuizzes(creatorId, { page, size: QUIZ_PAGE_SIZE })
      setMore((current) => appendQuizPage(current, base, latestData.current, page, response))
    } catch (moreLoadError) {
      setMoreFailure({ base, message: describeError(moreLoadError, 'Quiz를 더 불러오지 못했어요.') })
    } finally {
      moreInFlight.current = false
      setMoreLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-sm px-margin py-space-sm">
      {loading && <LoadingBlock label="Quiz를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && quizzes.length === 0 && <EmptyBlock icon="quiz" message="아직 공개된 Quiz가 없어요." />}
      {!loading && !error && quizzes.map((quiz) => (
        <button
          key={quiz.quizId}
          type="button"
          onClick={() => setOpenQuizId(quiz.quizId)}
          className="flex items-center gap-space-md p-space-md rounded-xl bg-surface-container-low text-left active:scale-[0.99] transition-all"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary">
            <MaterialIcon name="quiz" className="text-[22px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{quiz.title}</span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              {quiz.questionCount}문항 · 정답 1개당 응모권 1장
            </span>
          </span>
          <MaterialIcon name="chevron_right" className="text-[20px] text-outline" />
        </button>
      ))}
      {!loading && !error && moreError && <ErrorBlock message={moreError} onRetry={loadMore} />}
      {!loading && !error && hasNext && !moreError && (
        <button
          type="button"
          onClick={loadMore}
          disabled={moreLoading}
          className="self-center rounded-xl bg-surface-container px-4 py-2 font-label-sm text-label-sm font-semibold text-on-surface active:scale-95 transition-all disabled:opacity-60"
        >
          {moreLoading ? '불러오는 중...' : '더 보기'}
        </button>
      )}

      {openQuizId !== null && (
        <QuizSheet
          key={openQuizId}
          creatorId={creatorId}
          memberId={memberId}
          quizId={openQuizId}
          authenticated={authenticated}
          sessionLoading={sessionLoading}
          isMine={isMine}
          onLogin={onLogin}
          onRewardPaid={handleRewardPaid}
          onClose={() => setOpenQuizId(null)}
          onUnavailable={() => {
            setOpenQuizId(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function QuizSheet({ creatorId, memberId, quizId, authenticated, sessionLoading, isMine, onLogin, onRewardPaid, onClose, onUnavailable }) {
  const showToast = useToast()
  const detail = useAsync(() => getCreatorQuiz(creatorId, quizId), [creatorId, quizId], {
    fallbackMessage: 'Quiz를 불러오지 못했어요.',
  })
  // 로그인 사용자는 먼저 내 응시 기록을 확인해 이미 푼 Quiz면 결과를 보여주고 다시 풀지 못하게 한다.
  const mine = useAsync(() => getMyQuizAttempt(creatorId, quizId), [creatorId, quizId, authenticated], {
    enabled: authenticated,
    fallbackMessage: '내 응시 기록을 확인하지 못했어요.',
  })
  const [result, setResult] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [closed, setClosed] = useState(false)
  // 한 문항씩 푼다. 보기를 고르면 선택 표시를 잠깐 보여준 뒤 다음 문항으로 넘어간다.
  const [step, setStep] = useState(0)
  const advanceTimer = useRef(null)
  // 풀던 답안은 이 브라우저에 임시 저장해 두고, 다시 열면 아직 답하지 않은 문항부터 이어 푼다.
  const storage = browserStorage()
  const progressKey = memberId !== null && memberId !== undefined ? quizProgressKey(memberId, creatorId, quizId) : null
  const [restoredRevision, setRestoredRevision] = useState(null)
  const [openedAt] = useState(Date.now)
  const headingRef = useRef(null)
  // 응답을 받지 못해 다시 보낼 때는 같은 답안이면 같은 requestId를 쓴다. 답안이 바뀌면 새 요청이다.
  const pending = useRef(null)
  // 연타로 같은 요청이 겹쳐 나가지 않게 한다(상태 값은 다음 렌더 전까지 바뀌지 않는다).
  const submitInFlight = useRef(false)

  const attempt = result ?? mine.data ?? null
  const questions = detail.data?.questions ?? []
  // 응시 기록 확인이 끝난 뒤 문항을 불러왔으면 한 번만 되살린다(이미 푼 Quiz면 결과 화면이 우선이다).
  if (progressKey && detail.data && !mine.loading && !attempt && restoredRevision !== detail.data.revisionId) {
    setRestoredRevision(detail.data.revisionId)
    const restored = restoreQuizAnswers(readQuizProgress(storage, progressKey), detail.data.revisionId, questions, openedAt)
    if (restored) {
      setAnswers(restored)
      setStep(resumeStep(questions, restored))
    }
  }
  const view = quizStep(step, questions.length)
  const question = questions[view.index]

  useEffect(() => () => clearTimeout(advanceTimer.current), [])
  // 문항이 바뀌면 눌렀던 보기가 사라지므로 초점을 새 질문으로 옮긴다(키보드·스크린리더 사용자가 모달 밖으로 밀려나지 않게).
  const questionNo = question?.questionNo
  useEffect(() => {
    if (questionNo !== undefined) headingRef.current?.focus()
  }, [questionNo])

  function handleSelect(selectedQuestion, optionNo) {
    if (isMine || submitting || advanceTimer.current) return
    const next = { ...answers, [selectedQuestion.questionNo]: optionNo }
    setAnswers(next)
    if (progressKey) saveQuizProgress(storage, progressKey, detail.data.revisionId, next)
    // 마지막 문항은 고르기만 하고 제출 버튼으로 보낸다(고른 뒤 답을 바꿀 수 있게 하려는 것이다).
    if (!view.isLast) {
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null
        setStep((current) => current + 1)
      }, ADVANCE_DELAY_MS)
    }
  }

  function goBack() {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = null
    setStep((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(given = answers) {
    if (!authenticated) {
      onLogin()
      return
    }
    const allAnswered = questions.length > 0 && questions.every((item) => given[item.questionNo] !== undefined)
    if (closed || !allAnswered || submitInFlight.current) return
    const body = questions.map((item) => ({
      questionNo: item.questionNo,
      selectedOptionIndex: given[item.questionNo],
    }))
    pending.current = submitRequestFor(pending.current, body, newRequestId)
    submitInFlight.current = true
    setSubmitting(true)
    try {
      const saved = await submitQuizAttempt(creatorId, quizId, {
        requestId: pending.current.requestId,
        revisionId: detail.data.revisionId,
        answers: body,
      })
      pending.current = null
      if (progressKey) clearQuizProgress(storage, progressKey)
      setResult(saved)
    } catch (error) {
      await handleSubmitError(error)
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  async function handleSubmitError(error) {
    switch (classifySubmitError(error)) {
      case 'UNCERTAIN':
        // 응답을 받지 못했거나(NETWORK_ERROR 등) 서버 오류라 저장 여부를 모른다. 요청을 유지해 같은 답안으로 다시
        // 누르면 같은 requestId로 재전송하고, 이미 저장됐다면 BE가 저장된 결과를 돌려준다.
        showToast(describeError(error, '제출하지 못했어요. 다시 시도해 주세요.'), { icon: 'error' })
        return
      case 'ALREADY_ATTEMPTED':
        pending.current = null
        if (progressKey) clearQuizProgress(storage, progressKey)
        showToast('이미 응시한 Quiz예요. 저장된 결과를 보여드릴게요.')
        mine.reload()
        return
      case 'REVISION_CHANGED':
        pending.current = null
        setAnswers({})
        setStep(0)
        if (progressKey) clearQuizProgress(storage, progressKey)
        showToast('Quiz 내용이 바뀌었어요. 새 문항으로 다시 풀어 주세요.', { icon: 'error' })
        detail.reload()
        return
      case 'CLOSED':
        pending.current = null
        setClosed(true)
        showToast('마감된 Quiz예요. 신규 응시는 할 수 없어요.', { icon: 'error' })
        mine.reload()
        return
      case 'NOT_FOUND':
        showToast('더 이상 공개되지 않은 Quiz예요.', { icon: 'error' })
        onUnavailable()
        return
      default:
        pending.current = null
        showToast(describeError(error, '제출하지 못했어요.'), { icon: 'error' })
    }
  }

  const title = attempt?.title ?? detail.data?.title ?? 'Quiz'
  const loading = detail.loading || (authenticated && mine.loading) || sessionLoading

  return (
    <QuizScreen onClose={onClose} title={title}>
      {loading && <LoadingBlock label="Quiz를 불러오는 중..." />}
      {!loading && attempt && (
        <QuizResult
          creatorId={creatorId}
          quizId={quizId}
          attempt={attempt}
          onUpdate={setResult}
          onRewardPaid={onRewardPaid}
        />
      )}
      {!loading && !attempt && mine.error && <ErrorBlock message={mine.error} onRetry={mine.reload} />}
      {!loading && !attempt && !mine.error && detail.error && (
        <ErrorBlock message={detail.error} onRetry={detail.reload} />
      )}
      {!loading && !attempt && closed && <p role="status" className="rounded-xl bg-surface-container p-space-md">마감된 Quiz예요. 신규 응시는 할 수 없어요.</p>}
      {!loading && !attempt && !closed && !mine.error && !detail.error && detail.data && (
        <div className="flex flex-1 flex-col gap-space-md">
          <QuizSourceVideo videoId={detail.data.videoId} />
          {question && (
            <div role="group" aria-labelledby="quiz-question" key={question.questionNo} className="flex flex-1 flex-col gap-space-sm">
              <h2
                id="quiz-question"
                ref={headingRef}
                tabIndex={-1}
                className="pb-space-md pt-space-sm font-headline-xl-mobile outline-none text-headline-xl-mobile font-extrabold leading-snug text-on-surface"
              >
                {question.question}
              </h2>
              <div className="mt-space-sm flex items-center justify-between gap-2">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant">
                  {view.number} / {view.total}
                </span>
                {!view.isFirst && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={submitting}
                    className="flex items-center gap-0.5 rounded-xl bg-surface-container px-3 py-1.5 font-label-xs text-label-xs font-semibold text-on-surface active:scale-95 transition-all disabled:opacity-60"
                  >
                    <MaterialIcon name="chevron_left" className="text-[16px]" />
                    이전
                  </button>
                )}
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={view.total}
                aria-valuenow={view.number}
                className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high"
              >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(view.number / view.total) * 100}%` }} />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-space-sm py-space-md">
                {question.options.map((option) => {
                  const selected = answers[question.questionNo] === option.optionNo
                  return (
                    <button
                      key={option.optionNo}
                      type="button"
                      aria-pressed={selected}
                      disabled={isMine || submitting}
                      onClick={() => handleSelect(question, option.optionNo)}
                      className={`flex items-center gap-space-sm rounded-xl px-space-md py-5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <MaterialIcon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} className="text-[20px]" />
                      <span className="font-body-md text-body-md font-semibold">{option.text}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {isMine && (
            <p className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
              내 스페이스의 Quiz는 응시할 수 없어요.
            </p>
          )}
          {/* 마지막 보기를 고른 뒤 이 버튼으로 제출한다. 비로그인은 로그인으로 보내고, 제출에 실패하면 같은 답안으로 다시 보낸다. */}
          {!isMine && view.isLast && question && answers[question.questionNo] !== undefined && (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={authenticated && submitting}
              className="w-full rounded-xl bg-primary py-3 text-on-primary font-label-md text-label-md font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!authenticated ? '로그인하고 제출' : submitting ? '채점하는 중...' : '제출'}
            </button>
          )}
        </div>
      )}
    </QuizScreen>
  )
}

/** Quiz를 만든 YouTube 영상. 썸네일로 어떤 영상인지 알아보고, 누르면 YouTube에서 연다. */
function QuizSourceVideo({ videoId }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  if (!videoId) return null
  const id = encodeURIComponent(videoId)
  return (
    <a
      href={`https://www.youtube.com/watch?v=${id}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="이 영상으로 만든 Quiz예요. YouTube에서 보기"
      className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-2 pr-space-md active:scale-[0.98] transition-all"
    >
      {thumbnailFailed ? (
        <span className="flex aspect-video w-24 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
          <MaterialIcon name="smart_display" className="text-[24px]" />
        </span>
      ) : (
        <img
          src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setThumbnailFailed(true)}
          className="aspect-video w-24 shrink-0 rounded-lg bg-surface-container-high object-cover"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">이 영상으로 만든 Quiz예요</span>
        <span className="inline-flex items-center gap-1 font-label-xs text-label-xs font-semibold text-primary">
          YouTube에서 보기
          <MaterialIcon name="open_in_new" className="text-[14px]" />
        </span>
      </span>
    </a>
  )
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Quiz를 푸는 동안 화면 전체를 쓴다. 한 문항씩 크게 보여주고 마지막에 점수 화면으로 이어진다.
 * 모달이므로 열 때 초점을 안으로 옮기고, Tab이 밖으로 나가지 않게 하며, Escape로 닫고 닫은 뒤 이전 초점으로 돌려준다.
 */
function QuizScreen({ onClose, title, children }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
    if (items.length === 0) {
      event.preventDefault()
      dialogRef.current.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[60] flex flex-col bg-surface outline-none"
    >
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-2 px-margin pt-space-md md:max-w-2xl">
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface active:scale-95 transition-all"
        >
          <MaterialIcon name="close" className="text-[26px]" />
        </button>
        <span className="min-w-0 truncate font-label-sm text-label-sm font-semibold text-on-surface-variant">{title}</span>
        <span className="h-10 w-10" />
      </div>
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col overflow-y-auto px-margin pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-space-md md:max-w-2xl">
        {children}
      </div>
    </div>
  )
}

function QuizResult({ creatorId, quizId, attempt, onUpdate, onRewardPaid }) {
  const showToast = useToast()
  const reward = attempt.reward
  const payment = PAYMENT_LABELS[reward?.paymentStatus] ?? PAYMENT_LABELS.UNAVAILABLE
  const [polls, setPolls] = useState(0)
  const [checking, setChecking] = useState(false)
  const attemptId = attempt.attemptId

  // 지급 완료를 확인하면(처음 조회했을 때 이미 PAID인 경우 포함) 응모권 잔액을 다시 불러온다. 같은 응시는 한 번만 한다.
  useEffect(() => {
    if (reward?.paymentStatus === 'PAID') onRewardPaid?.(attemptId)
  }, [reward?.paymentStatus, attemptId, onRewardPaid])

  // 지급 처리 중이면 정해진 횟수만큼만 다시 조회한다.
  useEffect(() => {
    if (reward?.paymentStatus !== 'PENDING' || polls >= PAYMENT_POLL_MAX) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const latest = await getMyQuizAttempt(creatorId, quizId)
        if (!cancelled && latest) onUpdate(latest)
      } catch {
        // 조회 실패는 다음 시도나 사용자의 수동 확인에 맡긴다.
      } finally {
        if (!cancelled) setPolls((count) => count + 1)
      }
    }, PAYMENT_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [creatorId, quizId, reward?.paymentStatus, polls, onUpdate])

  async function checkAgain() {
    setChecking(true)
    try {
      const latest = await getMyQuizAttempt(creatorId, quizId)
      if (latest) onUpdate(latest)
      setPolls(0)
    } catch (error) {
      showToast(describeError(error, '지급 상태를 확인하지 못했어요.'), { icon: 'error' })
    } finally {
      setChecking(false)
    }
  }

  const canCheckAgain = ['DELAYED', 'UNAVAILABLE'].includes(reward?.paymentStatus)
    || (reward?.paymentStatus === 'PENDING' && polls >= PAYMENT_POLL_MAX)

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-low p-space-md text-center">
        <span className="font-label-sm text-label-sm text-on-surface-variant">내 점수</span>
        <span className="font-headline-xl-mobile text-headline-xl-mobile font-extrabold text-on-surface">
          {attempt.correctCount} / {attempt.questionCount}
        </span>
        <span className="font-label-xs text-label-xs text-outline">{formatDateTime(attempt.submittedAt)} 제출</span>
      </div>

      <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md font-semibold text-on-surface">응모권 보상</span>
          <StatusPill label={payment.label} icon={payment.icon} tone={payment.tone} />
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{paymentMessage(reward)}</p>
        {canCheckAgain && (
          <button
            type="button"
            onClick={checkAgain}
            disabled={checking}
            className="self-start rounded-xl bg-surface-container px-4 py-2 font-label-sm text-label-sm font-semibold text-on-surface active:scale-95 transition-all disabled:opacity-60"
          >
            {checking ? '확인하는 중...' : '지급 상태 다시 확인'}
          </button>
        )}
      </div>

      <QuizSourceVideo videoId={attempt.videoId} />

      {attempt.questions.map((question) => (
        <div key={question.questionNo} className="flex flex-col gap-space-xs">
          <p className="font-label-md text-label-md font-semibold text-on-surface">
            {question.questionNo + 1}. {question.question}
          </p>
          {question.options.map((option, index) => {
            const correct = index === question.correctOptionIndex
            const selected = index === question.selectedOptionIndex
            return (
              <div
                key={index}
                className={`flex items-center gap-space-sm rounded-xl px-space-md py-3 ${
                  correct ? 'bg-primary/10 text-on-surface' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <MaterialIcon
                  name={correct ? 'check_circle' : selected ? 'cancel' : 'radio_button_unchecked'}
                  className={`text-[20px] ${correct ? 'text-primary' : 'text-outline'}`}
                />
                <span className="flex-1 font-body-sm text-body-sm">{option}</span>
                {selected && <span className="font-label-xs text-label-xs font-semibold">내 선택</span>}
              </div>
            )
          })}
          {question.explanation && (
            <p className="rounded-xl bg-surface-container p-space-sm font-body-sm text-body-sm text-on-surface-variant">
              {question.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
