import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendationReason } from '../src/utils/recommendationReason.js'

test('추천 응답에 기여한 관심 분야만 이름으로 표시한다', () => {
  const names = new Map([['FOOD', '요리·푸드'], ['FITNESS', '운동·건강']])
  assert.equal(
    recommendationReason({ interestCodes: ['FOOD', 'FITNESS'], seedCreatorIds: [2] }, names),
    '선택한 요리·푸드, 운동·건강 관심사 기반 추천',
  )
})

test('분야 기여가 없으면 팔로우 이유를 표시하고 인기순 대체에는 이유를 표시하지 않는다', () => {
  const names = new Map()
  assert.equal(recommendationReason({ interestCodes: [], seedCreatorIds: [2] }, names), '내가 도킹한 크리에이터와 비슷해요')
  assert.equal(recommendationReason({ interestCodes: [], seedCreatorIds: [] }, names), null)
})

test('인자가 아직 준비되지 않은 상태에서도 추천 이유 계산은 안전하다', () => {
  assert.equal(recommendationReason(), null)
  assert.equal(recommendationReason(null, null), null)
  assert.equal(recommendationReason({ interestCodes: ['FOOD'], seedCreatorIds: [2] }, null), '내가 도킹한 크리에이터와 비슷해요')
})
