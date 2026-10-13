import { useCallback, useEffect, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError, newRequestId } from '../../api/client.js'
import { getCreatorQuiz, getCreatorQuizzes, getMyQuizAttempt, submitQuizAttempt } from '../../api/quizzes.js'
import { formatDateTime } from '../../utils/format.js'

// 지급 처리 중(PENDING)이면 이 간격으로 이 횟수만큼만 다시 조회한다. 그 뒤에는 사용자가 직접 다시 확인한다.
const PAYMENT_POLL_INTERVAL_MS = 3000
const PAYMENT_POLL_MAX = 5

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
export default function CreatorQuizzes({ creatorId, authenticated, sessionLoading, isMine, onLogin, onRewardPaid }) {
  const [openQuizId, setOpenQuizId] = useState(null)
  // 지급 완료를 확인한 응시는 잔액을 한 번만 다시 불러온다(시트를 다시 열 때마다 반복하지 않는다).
  const refreshedAttempts = useRef(new Set())
  const handleRewardPaid = useCallback((attemptId) => {
    if (refreshedAttempts.current.has(attemptId)) return
    refreshedAttempts.current.add(attemptId)
    onRewardPaid?.()
  }, [onRewardPaid])
  const { data, loading, error, reload } = useAsync(
    () => getCreatorQuizzes(creatorId),
    [creatorId],
    { fallbackMessage: 'Quiz 목록을 불러오지 못했어요.' },
  )
  const quizzes = data?.items ?? []

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

      {openQuizId !== null && (
        <QuizSheet
          key={openQuizId}
          creatorId={creatorId}
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

function QuizSheet({ creatorId, quizId, authenticated, sessionLoading, isMine, onLogin, onRewardPaid, onClose, onUnavailable }) {
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
  // 응답을 받지 못해 다시 보낼 때는 같은 답안이면 같은 requestId를 쓴다. 답안이 바뀌면 새 요청이다.
  const pending = useRef(null)

  const attempt = result ?? mine.data ?? null
  const questions = detail.data?.questions ?? []
  const allAnswered = questions.length > 0 && questions.every((question) => answers[question.questionNo] !== undefined)

  async function handleSubmit() {
    if (!authenticated) {
      onLogin()
      return
    }
    if (!allAnswered || submitting) return
    const body = questions.map((question) => ({
      questionNo: question.questionNo,
      selectedOptionIndex: answers[question.questionNo],
    }))
    const key = JSON.stringify(body)
    if (pending.current?.key !== key) pending.current = { key, requestId: newRequestId() }
    setSubmitting(true)
    try {
      const saved = await submitQuizAttempt(creatorId, quizId, {
        requestId: pending.current.requestId,
        revisionId: detail.data.revisionId,
        answers: body,
      })
      pending.current = null
      setResult(saved)
    } catch (error) {
      await handleSubmitError(error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitError(error) {
    if (!(error instanceof ApiError)) {
      // 네트워크 오류 등 응답을 받지 못했다. 같은 답안으로 다시 누르면 같은 requestId로 재전송한다.
      showToast(describeError(error, '제출하지 못했어요. 다시 시도해 주세요.'), { icon: 'error' })
      return
    }
    if (error.code === 'QUIZ_ALREADY_ATTEMPTED' || error.code === 'QUIZ_ATTEMPT_REQUEST_CONFLICT') {
      pending.current = null
      showToast('이미 응시한 Quiz예요. 저장된 결과를 보여드릴게요.')
      mine.reload()
      return
    }
    if (error.code === 'QUIZ_PUBLISHED_REVISION_CHANGED') {
      pending.current = null
      setAnswers({})
      showToast('Quiz 내용이 바뀌었어요. 새 문항으로 다시 풀어 주세요.', { icon: 'error' })
      detail.reload()
      return
    }
    if (error.code === 'QUIZ_NOT_FOUND') {
      showToast('더 이상 공개되지 않은 Quiz예요.', { icon: 'error' })
      onUnavailable()
      return
    }
    pending.current = null
    showToast(describeError(error, '제출하지 못했어요.'), { icon: 'error' })
  }

  const title = attempt?.title ?? detail.data?.title ?? 'Quiz'
  const loading = detail.loading || (authenticated && mine.loading) || sessionLoading

  return (
    <BottomSheet open onClose={onClose} title={title} eyebrow="Quiz">
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
      {!loading && !attempt && !mine.error && !detail.error && detail.data && (
        <div className="flex flex-col gap-space-md">
          {questions.map((question) => (
            <fieldset key={question.questionNo} className="flex flex-col gap-space-xs">
              <legend className="mb-space-xs font-label-md text-label-md font-semibold text-on-surface">
                {question.questionNo + 1}. {question.question}
              </legend>
              {question.options.map((option) => {
                const selected = answers[question.questionNo] === option.optionNo
                return (
                  <button
                    key={option.optionNo}
                    type="button"
                    aria-pressed={selected}
                    disabled={isMine || submitting}
                    onClick={() => setAnswers((current) => ({ ...current, [question.questionNo]: option.optionNo }))}
                    className={`flex items-center gap-space-sm rounded-xl px-space-md py-3 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed ${
                      selected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <MaterialIcon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} className="text-[20px]" />
                    <span className="font-body-sm text-body-sm">{option.text}</span>
                  </button>
                )
              })}
            </fieldset>
          ))}

          {isMine ? (
            <p className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
              내 스페이스의 Quiz는 응시할 수 없어요.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={authenticated && (!allAnswered || submitting)}
              className="w-full rounded-xl bg-primary py-3 text-on-primary font-label-md text-label-md font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!authenticated ? '로그인하고 제출하기' : submitting ? '채점하는 중...' : allAnswered ? '제출하기' : '모든 문항에 답해 주세요'}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
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
