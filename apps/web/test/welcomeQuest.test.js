import assert from 'node:assert/strict'
import test from 'node:test'

import { WELCOME_QUEST_STEPS, WELCOME_QUEST_STATUS, buildClaimBody, markStepClaimed } from '../src/utils/welcomeQuest.js'

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
