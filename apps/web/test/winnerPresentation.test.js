import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWinnersByStatus,
  winnerEventTitle,
  winnerRankLabel,
  winnerStatusFilters,
} from '../src/utils/winnerPresentation.js'

const winners = [
  { winnerId: 1, eventId: 10, winnerManagementStatus: 'SELECTED' },
  { winnerId: 2, eventId: 11, winnerManagementStatus: 'RECEIVED' },
  { winnerId: 3, eventId: 12, winnerManagementStatus: 'SELECTED' },
]

test('전체 당첨 목록을 기준으로 상태별 정확한 건수를 만든다', () => {
  assert.deepEqual(winnerStatusFilters(winners), [
    { value: 'ALL', label: '전체', count: 3 },
    { value: 'SELECTED', label: '수령 대기', count: 2 },
    { value: 'RECEIVED', label: '수령 완료', count: 1 },
    { value: 'DECLINED', label: '당첨 포기', count: 0 },
    { value: 'DISQUALIFIED', label: '자격 박탈', count: 0 },
  ])
})

test('상태 필터는 이미 조회한 당첨 목록에서만 전환한다', () => {
  assert.deepEqual(filterWinnersByStatus(winners, 'SELECTED').map((winner) => winner.winnerId), [1, 3])
  assert.deepEqual(filterWinnersByStatus(winners, 'ALL').map((winner) => winner.winnerId), [1, 2, 3])
})

test('이벤트 목록으로 실제 제목을 보강하고 없으면 기존 식별자를 유지한다', () => {
  const eventById = new Map([[10, { title: '가을 커피 기프트 이벤트' }]])
  assert.equal(winnerEventTitle(winners[0], eventById), '가을 커피 기프트 이벤트')
  assert.equal(winnerEventTitle(winners[1], eventById), '이벤트 #11')
})

test('당첨 순위를 사용자 표현으로 바꾼다', () => {
  assert.equal(winnerRankLabel(1), '1등 당첨')
  assert.equal(winnerRankLabel(3), '3등 당첨')
  assert.equal(winnerRankLabel(null), '당첨')
})
