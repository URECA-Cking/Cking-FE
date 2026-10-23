// 웰컴 퀘스트 보상 단계. 값은 BE 계약(POST /api/me/welcome-quest/{step}/claim)의 step과 같다.
export const WELCOME_QUEST_STEPS = Object.freeze({
  SIGNUP: 'SIGNUP',
  FOLLOW: 'FOLLOW',
  QUIZ: 'QUIZ',
  BONUS: 'BONUS',
})

// 지급 상태. 계약의 status와 같다.
export const WELCOME_QUEST_STATUS = Object.freeze({
  CLAIMED: 'CLAIMED',
  CLAIMABLE: 'CLAIMABLE',
  NOT_MET: 'NOT_MET',
})

// 퀘스트 완료(completed)를 이루는 세 단계. 보너스는 독립이라 포함하지 않는다.
const QUEST_STEPS = [WELCOME_QUEST_STEPS.SIGNUP, WELCOME_QUEST_STEPS.FOLLOW, WELCOME_QUEST_STEPS.QUIZ]

/**
 * 지급 요청 본문을 만든다. answer는 QUIZ 단계에서만 보내며, 다른 단계에 보내면 서버가 거부한다.
 * answer가 불리언이 아니면 QUIZ라도 담지 않아 서버의 형식 검증에 맡긴다.
 */
export function buildClaimBody(step, { requestId, answer } = {}) {
  if (step === WELCOME_QUEST_STEPS.QUIZ && typeof answer === 'boolean') return { requestId, answer }
  return { requestId }
}

/**
 * 지급이 승인된 단계를 CLAIMED로 표시한 새 상태를 돌려준다. 서버 응답을 다시 받기 전까지 화면을 맞추기 위한 값이다.
 * 세 단계가 모두 CLAIMED가 되면 completed도 true로 맞춘다. 비대상(eligible=false)이거나 상태가 없으면 그대로 둔다.
 */
export function markStepClaimed(quest, step) {
  if (!quest?.eligible) return quest
  const items = (quest.items ?? []).map((item) => (
    item.step === step ? { ...item, status: WELCOME_QUEST_STATUS.CLAIMED } : item
  ))
  const bonus = quest.bonus && quest.bonus.step === step
    ? { ...quest.bonus, status: WELCOME_QUEST_STATUS.CLAIMED }
    : quest.bonus
  const completed = QUEST_STEPS.every((questStep) => (
    items.find((item) => item.step === questStep)?.status === WELCOME_QUEST_STATUS.CLAIMED
  ))
  return { ...quest, items, bonus, completed }
}

/** 퀘스트 항목(SIGNUP·FOLLOW·QUIZ) 중 해당 단계를 찾는다. 상태가 없으면 undefined다. */
export function findQuestItem(quest, step) {
  return quest?.items?.find((item) => item.step === step)
}

/** 신규 회원 홈 구성 대상인지 판별한다. 신규 대상(eligible)이고 세 단계가 아직 끝나지 않았을 때만 true다. */
export function isWelcomeQuestActive(quest) {
  return quest?.eligible === true && quest.completed !== true
}

/** 지급이 끝난 단계 수(0~3)를 센다. 보너스는 세지 않는다. */
export function countClaimedSteps(quest) {
  return QUEST_STEPS.filter((step) => findQuestItem(quest, step)?.status === WELCOME_QUEST_STATUS.CLAIMED).length
}

/** 달성률(0~100 정수)을 세 단계 기준으로 계산한다. */
export function questPercent(quest) {
  return Math.round((countClaimedSteps(quest) / QUEST_STEPS.length) * 100)
}

/** 퀘스트를 이루는 단계 수(보너스 제외). */
export const WELCOME_QUEST_STEP_COUNT = QUEST_STEPS.length

// 서버가 준 문구 대신 화면에서 정한 안내를 쓸 오류 코드.
const FAILURE_MESSAGES = {
  WELCOME_QUEST_WRONG_ANSWER: '다시 생각해 보세요! 크킹에서는 무료로 응모권을 모을 수 있어요.',
  WELCOME_QUEST_CONDITION_NOT_MET: '먼저 크리에이터에 도킹해 주세요.',
  WELCOME_QUEST_NOT_ELIGIBLE: '웰컴 퀘스트 대상이 아니에요.',
}

/** 지급 실패 코드에 맞는 안내 문구를 돌려준다. 정해 둔 문구가 없으면 null이라 호출자가 공통 문구나 기본 문구를 쓴다. */
export function claimFailureMessage(code) {
  return FAILURE_MESSAGES[code] ?? null
}
