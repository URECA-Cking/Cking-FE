import assert from 'node:assert/strict'
import test from 'node:test'

import {
  WELCOME_QUEST_STEPS,
  WELCOME_QUEST_STATUS,
  buildClaimBody,
  claimFailureMessage,
  countClaimedSteps,
  findQuestItem,
  isWelcomeQuestActive,
  markStepClaimed,
  questPercent,
} from '../src/utils/welcomeQuest.js'

const quest = (statuses = {}) => ({
  eligible: true,
  completed: false,
  items: [
    { step: 'SIGNUP', rewardAmount: 1, status: statuses.SIGNUP ?? 'CLAIMABLE' },
    { step: 'FOLLOW', rewardAmount: 1, status: statuses.FOLLOW ?? 'NOT_MET' },
    { step: 'QUIZ', rewardAmount: 1, status: statuses.QUIZ ?? 'CLAIMABLE' },
  ],
  bonus: { step: 'BONUS', rewardAmount: 1, status: statuses.BONUS ?? 'CLAIMABLE' },
})

test('QUIZ 요청에만 answer를 담는다', () => {
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.QUIZ, { requestId: 'id-1', answer: true }), { requestId: 'id-1', answer: true })
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.QUIZ, { requestId: 'id-1', answer: false }), { requestId: 'id-1', answer: false })
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.SIGNUP, { requestId: 'id-2', answer: true }), { requestId: 'id-2' })
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.BONUS, { requestId: 'id-3' }), { requestId: 'id-3' })
})

test('QUIZ라도 answer가 불리언이 아니면 담지 않아 서버 검증에 맡긴다', () => {
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.QUIZ, { requestId: 'id-1', answer: 'true' }), { requestId: 'id-1' })
  assert.deepEqual(buildClaimBody(WELCOME_QUEST_STEPS.QUIZ, { requestId: 'id-1' }), { requestId: 'id-1' })
})

test('지급된 단계만 CLAIMED로 바꾸고 원본 상태는 건드리지 않는다', () => {
  const before = quest()
  const after = markStepClaimed(before, 'SIGNUP')

  assert.equal(after.items.find((item) => item.step === 'SIGNUP').status, WELCOME_QUEST_STATUS.CLAIMED)
  assert.equal(after.items.find((item) => item.step === 'QUIZ').status, WELCOME_QUEST_STATUS.CLAIMABLE)
  assert.equal(after.completed, false)
  assert.equal(before.items[0].status, 'CLAIMABLE')
})

test('세 단계가 모두 CLAIMED가 되면 completed가 true가 된다', () => {
  const after = markStepClaimed(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED' }), 'QUIZ')
  assert.equal(after.completed, true)
})

test('보너스는 독립이라 completed에 영향을 주지 않고 자기 상태만 바뀐다', () => {
  const after = markStepClaimed(quest(), 'BONUS')
  assert.equal(after.bonus.status, WELCOME_QUEST_STATUS.CLAIMED)
  assert.equal(after.completed, false)
  assert.ok(after.items.every((item) => item.status !== 'CLAIMED'))

  const allSteps = markStepClaimed(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED', QUIZ: 'CLAIMED' }), 'SIGNUP')
  assert.equal(allSteps.completed, true)
  assert.equal(allSteps.bonus.status, 'CLAIMABLE')
})

test('상태가 없거나 비대상 회원이면 그대로 돌려준다', () => {
  assert.equal(markStepClaimed(null, 'SIGNUP'), null)
  const ineligible = { eligible: false, completed: false, items: [], bonus: null }
  assert.equal(markStepClaimed(ineligible, 'SIGNUP'), ineligible)
})

test('신규 홈 구성 대상은 대상이면서 세 단계가 끝나지 않은 회원이다', () => {
  assert.equal(isWelcomeQuestActive(quest()), true)
  // completed는 서버가 계산해 내려주는 값이라 헬퍼가 만들지 않는다. 세 단계가 모두 지급된 상태로 직접 지정한다.
  assert.equal(isWelcomeQuestActive({ ...quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED', QUIZ: 'CLAIMED' }), completed: true }), false)
  assert.equal(isWelcomeQuestActive({ eligible: false, completed: false, items: [], bonus: null }), false)
  assert.equal(isWelcomeQuestActive(null), false)
})

test('보너스만 받았고 세 단계가 안 끝났으면 여전히 신규 홈 구성 대상이다', () => {
  assert.equal(isWelcomeQuestActive(quest({ BONUS: 'CLAIMED' })), true)
})

test('지급이 끝난 단계 수와 달성률은 세 단계 기준이다', () => {
  assert.equal(countClaimedSteps(quest()), 0)
  assert.equal(countClaimedSteps(quest({ SIGNUP: 'CLAIMED' })), 1)
  assert.equal(countClaimedSteps(quest({ SIGNUP: 'CLAIMED', QUIZ: 'CLAIMED', BONUS: 'CLAIMED' })), 2)
  assert.equal(questPercent(quest()), 0)
  assert.equal(questPercent(quest({ SIGNUP: 'CLAIMED' })), 33)
  assert.equal(questPercent(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED' })), 67)
  assert.equal(questPercent(quest({ SIGNUP: 'CLAIMED', FOLLOW: 'CLAIMED', QUIZ: 'CLAIMED' })), 100)
  assert.equal(questPercent(null), 0)
})

test('단계 항목을 찾고 없으면 undefined를 돌려준다', () => {
  assert.equal(findQuestItem(quest(), 'FOLLOW').status, 'NOT_MET')
  assert.equal(findQuestItem(quest(), 'BONUS'), undefined)
  assert.equal(findQuestItem(null, 'FOLLOW'), undefined)
})

test('정해 둔 지급 실패 코드는 안내 문구를, 그 밖의 코드는 null을 돌려준다', () => {
  assert.equal(claimFailureMessage('WELCOME_QUEST_WRONG_ANSWER'), '다시 생각해 보세요! 크킹에서는 무료로 응모권을 모을 수 있어요.')
  assert.equal(claimFailureMessage('WELCOME_QUEST_CONDITION_NOT_MET'), '먼저 관심 크리에이터를 팔로우해 주세요.')
  assert.equal(claimFailureMessage('EARN_STATUS_UNKNOWN'), null)
  assert.equal(claimFailureMessage(undefined), null)
})
