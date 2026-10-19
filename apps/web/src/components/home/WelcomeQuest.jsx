import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import FilledCheck from './FilledCheck.jsx'
import {
  WELCOME_QUEST_STATUS,
  WELCOME_QUEST_STEPS,
  WELCOME_QUEST_STEP_COUNT,
  countClaimedSteps,
  findQuestItem,
  questPercent,
} from '../../utils/welcomeQuest.js'

// 시작 가이드의 단계 정의. 화면 문구와 아이콘만 담고, 지급 조건 판정은 서버가 한다.
const STEPS = [
  { step: WELCOME_QUEST_STEPS.SIGNUP, no: 1, title: '크킹 가입 및 첫 로그인', icon: 'redeem', tile: 'bg-primary/15 text-primary' },
  { step: WELCOME_QUEST_STEPS.FOLLOW, no: 2, title: '크리에이터 1명 도킹', icon: 'person_add', tile: 'bg-primary/15 text-primary' },
  { step: WELCOME_QUEST_STEPS.QUIZ, no: 3, title: '5초 OX 퀴즈 맛보기', icon: 'quiz', tile: 'bg-warm-accent/20 text-warm-accent' },
]

/**
 * 단계 카드의 오른쪽 동작 문구를 정한다. 지급 요청 중이면 받는 중, 조건을 못 채운 팔로우는 하러가기다.
 * 반환값이 null이면 동작이 없는 완료 상태다.
 */
function actionLabel({ step, status, claiming }) {
  if (status === WELCOME_QUEST_STATUS.CLAIMED) return null
  if (claiming) return '받는 중...'
  if (step === WELCOME_QUEST_STEPS.QUIZ) return '도전하기'
  if (status === WELCOME_QUEST_STATUS.NOT_MET) return '하러가기'
  return '받기'
}

/** 웰컴 퀘스트 히어로 카드. 달성률 바와 완료 시 응모하러 가기 버튼을 보여준다. */
function QuestHero({ nickname, quest }) {
  const claimed = countClaimedSteps(quest)
  const percent = questPercent(quest)
  const allDone = quest.completed === true

  return (
    <section className="mt-4 px-margin animate-welcome-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#c2417f] via-[#dc5a92] to-[#f4a0c0] p-5 text-white shadow-lg shadow-primary/20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-label-sm text-label-sm backdrop-blur-sm">
            <span aria-hidden="true">🎉</span>
            첫 로그인 웰컴 기프트 도착
          </span>
          <h2 className="mt-3 font-headline-md text-headline-md break-keep [overflow-wrap:anywhere]">
            {allDone ? (
              '웰컴 퀘스트 완료!'
            ) : (
              <>
                반가워요{nickname ? `, ${nickname}님` : ''}!
                <br />
                <span className="text-amber-300">무료 응모권 4장</span>을 받아가세요
              </>
            )}
          </h2>
          <p className="mt-1.5 font-label-sm text-label-sm font-normal text-white/80">
            {allDone ? '모은 응모권으로 지금 바로 이벤트에 응모해보세요.' : '아래 3단계 스타터 미션을 완료하면 지급돼요.'}
          </p>

          <div className="mt-4 rounded-2xl bg-black/20 p-3 backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between font-label-sm text-label-sm">
              <span>웰컴 퀘스트 달성률</span>
              <span className="text-amber-300">{claimed} / {WELCOME_QUEST_STEP_COUNT} 완료 ({percent}%)</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="웰컴 퀘스트 달성률"
              className="h-2.5 w-full overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {allDone && (
            <Link
              to="/explore?tab=event"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 font-label-md text-label-md font-semibold text-primary active:opacity-80 transition-opacity"
            >
              응모하러 가기
              <MaterialIcon name="arrow_forward" className="text-[18px]" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

/** STEP 3 OX 퀴즈 카드. 고른 답을 서버에 보내 판정하며 오답 안내는 부모가 넘긴 문구를 보여준다. */
function QuizCard({ disabled, message, onAnswer }) {
  return (
    <div className="px-3.5 pb-3.5">
      <div className="rounded-2xl bg-gradient-to-br from-surface-container-lowest to-secondary/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-label-sm text-label-sm font-bold text-slate-900">
            5초 순삭 OX 퀴즈
          </span>
          <span className="font-label-sm text-label-sm font-normal text-on-surface-variant">정답 시 즉시 +1장</span>
        </div>
        <p className="mb-4 font-label-md text-label-md font-bold leading-relaxed text-on-surface break-keep">
          Q. 크킹에서는 크리에이터 미션에 참여하면 <span className="text-warm-accent underline underline-offset-2">무료로 응모권</span>을 모을 수 있다?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(true)}
            className="rounded-2xl bg-primary py-3 font-headline-md text-headline-md text-on-primary shadow-md active:scale-95 transition-transform disabled:opacity-60"
          >
            O 맞다
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(false)}
            className="rounded-2xl bg-on-surface/10 py-3 font-headline-md text-headline-md text-on-surface active:scale-95 transition-transform disabled:opacity-60"
          >
            X 아니다
          </button>
        </div>
        {message && (
          <p role="alert" className="mt-3 text-center font-label-sm text-label-sm text-warm-accent">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * 신규 회원용 웰컴 퀘스트(히어로 + 시작 가이드). 단계 상태와 지급은 서버가 판정하고 이 컴포넌트는 표시와 요청만 한다.
 * - STEP 1은 처음 표시될 때 받을 수 있으면 회원당 한 번 자동으로 지급을 요청한다(실패하면 "받기"로 다시 누른다).
 * - STEP 2는 받을 수 있으면 지급을 요청하고, 아직 팔로우가 없으면 onGoFollow로 인기 크리에이터 섹션으로 보낸다.
 * - STEP 3은 펼쳐서 OX 퀴즈를 보이고 고른 답을 서버에 보낸다. 정답은 이 화면이 알지 못한다.
 * 가이드를 닫으면(hidden) 히어로와 가이드는 빠지고 다시 보기 버튼만 남는다.
 */
export default function WelcomeQuest({ memberId, nickname, quest, claimingSteps, onClaim, hidden, onHide, onShow, onGoFollow }) {
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizMessage, setQuizMessage] = useState(null)
  // 자동 지급을 이미 시도한 회원. 실패한 뒤 상태가 다시 그려져도 같은 회원에게 반복해서 요청하지 않는다.
  const autoClaimed = useRef(new Set())

  const signupStatus = findQuestItem(quest, WELCOME_QUEST_STEPS.SIGNUP)?.status
  useEffect(() => {
    if (memberId == null || signupStatus !== WELCOME_QUEST_STATUS.CLAIMABLE) return
    if (autoClaimed.current.has(memberId)) return
    autoClaimed.current.add(memberId)
    onClaim(WELCOME_QUEST_STEPS.SIGNUP)
  }, [memberId, signupStatus, onClaim])

  /**
   * 퀴즈에서 고른 답을 서버에 보내고, 정답이면 카드를 닫고 오답이면 안내 문구를 보여준다.
   * 새 답을 보낼 때 이전 오답 문구를 먼저 지워, 이번 요청이 네트워크 오류 등으로 실패해도 예전 오답 안내가 남아 오해하지 않게 한다.
   */
  async function answerQuiz(answer) {
    setQuizMessage(null)
    const outcome = await onClaim(WELCOME_QUEST_STEPS.QUIZ, { answer })
    if (outcome.status === 'wrong') {
      setQuizMessage(outcome.message)
    } else if (outcome.status === 'claimed') {
      setQuizOpen(false)
    }
  }

  /** 단계 카드를 눌렀을 때의 동작을 고른다. 퀴즈는 펼침을 바꾸고, 팔로우는 조건에 따라 지급 또는 이동이다. */
  function handleStep({ step, status }) {
    if (step === WELCOME_QUEST_STEPS.QUIZ) {
      setQuizOpen((open) => !open)
    } else if (status === WELCOME_QUEST_STATUS.NOT_MET) {
      onGoFollow()
    } else {
      onClaim(step)
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="mx-margin mt-4 flex items-center justify-center gap-1 rounded-xl bg-surface-container py-2 font-label-sm text-label-sm text-on-surface-variant active:opacity-80 transition-opacity"
      >
        <span aria-hidden="true">🚀</span>
        시작 가이드 다시 보기
      </button>
    )
  }

  return (
    <>
      <QuestHero nickname={nickname} quest={quest} />

      <section className="mt-6 px-margin">
        <div className="mb-2.5 flex items-end justify-between gap-2">
          <h3 className="text-sm font-extrabold text-on-surface"><span aria-hidden="true">🚀</span> 1분 만에 끝내는 시작 가이드</h3>
          <button
            type="button"
            onClick={onHide}
            className="shrink-0 pb-0.5 font-label-sm text-label-sm text-outline hover:text-on-surface-variant transition-colors"
          >
            가이드 닫기
          </button>
        </div>

        <ul className="flex flex-col gap-2.5">
          {STEPS.map((definition) => {
            const status = findQuestItem(quest, definition.step)?.status
            const claiming = claimingSteps.includes(definition.step)
            const done = status === WELCOME_QUEST_STATUS.CLAIMED
            const open = definition.step === WELCOME_QUEST_STEPS.QUIZ && quizOpen && !done
            const label = actionLabel({ step: definition.step, status, claiming })
            return (
              <li key={definition.step} className={`rounded-2xl bg-surface-container transition-all ${open ? 'ring-2 ring-primary/50' : ''}`}>
                <button
                  type="button"
                  disabled={done || claiming}
                  aria-expanded={definition.step === WELCOME_QUEST_STEPS.QUIZ && !done ? open : undefined}
                  onClick={() => handleStep({ step: definition.step, status })}
                  className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {done ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                        <FilledCheck size={22} />
                      </span>
                    ) : (
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${definition.tile}`}>
                        <span aria-hidden="true" className="material-symbols-rounded text-[22px]">{definition.icon}</span>
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-label-md text-label-md font-extrabold text-on-surface break-keep">
                        STEP {definition.no}. {definition.title}
                      </span>
                      <span className={`block font-label-sm text-label-sm font-bold break-keep ${done ? 'text-success-text' : 'text-primary'}`}>
                        {done ? '응모권 +1장 지급 완료' : '보상: 공통 응모권 +1장'}
                      </span>
                    </span>
                  </span>
                  {done ? (
                    <span className="shrink-0 rounded-lg bg-on-surface/10 px-2.5 py-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">완료됨</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-xl bg-primary px-3 py-1.5 font-label-sm text-label-sm text-on-primary">
                      {label}
                      {definition.step === WELCOME_QUEST_STEPS.QUIZ && (
                        <MaterialIcon name={open ? 'expand_less' : 'expand_more'} className="text-[16px]" />
                      )}
                    </span>
                  )}
                </button>
                {open && <QuizCard disabled={claiming} message={quizMessage} onAnswer={answerQuiz} />}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
