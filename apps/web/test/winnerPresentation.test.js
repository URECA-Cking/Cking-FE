import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWinnersByStatus,
  groupWinnersByDraw,
  isActiveWin,
  pickWinnerPerEvent,
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

test('당첨 포기·자격 박탈은 더 이상 유효한 당첨이 아니다', () => {
  assert.equal(isActiveWin({ winnerManagementStatus: 'SELECTED' }), true)
  assert.equal(isActiveWin({ winnerManagementStatus: 'RECEIVED' }), true)
  assert.equal(isActiveWin({ winnerManagementStatus: 'DECLINED' }), false)
  assert.equal(isActiveWin({ winnerManagementStatus: 'DISQUALIFIED' }), false)
})

test('상태 필드가 없는 응답은 당첨으로 보고, 당첨 자체가 없으면 유효하지 않다', () => {
  assert.equal(isActiveWin({ winnerId: 1 }), true)
  assert.equal(isActiveWin(null), false)
  assert.equal(isActiveWin(undefined), false)
})

test('이벤트마다 내 당첨 하나를 고르고, 같은 이벤트면 유효한 당첨을 먼저 쓴다', () => {
  const declined = { winnerId: 1, eventId: 10, drawNo: 0, winnerManagementStatus: 'DECLINED' }
  const selected = { winnerId: 2, eventId: 10, drawNo: 1, winnerManagementStatus: 'SELECTED' }
  const other = { winnerId: 3, eventId: 11, winnerManagementStatus: 'RECEIVED' }

  // 입력 순서와 상관없이 유효한 당첨이 남는다.
  assert.equal(pickWinnerPerEvent([declined, selected, other]).get(10), selected)
  assert.equal(pickWinnerPerEvent([selected, declined, other]).get(10), selected)
  assert.equal(pickWinnerPerEvent([declined, selected, other]).get(11), other)
  // 둘 다 유효하지 않으면 나중 회차를 쓴다.
  const disqualified = { winnerId: 4, eventId: 10, drawNo: 1, winnerManagementStatus: 'DISQUALIFIED' }
  assert.equal(pickWinnerPerEvent([declined, disqualified]).get(10), disqualified)
  assert.equal(pickWinnerPerEvent(undefined).size, 0)
})

const drawWinner = (winnerId, drawNo, rankInDrawing, drawType = drawNo === 0 ? 'INITIAL' : 'REDRAW') => ({ winnerId, drawNo, drawType, rankInDrawing })

test('회차가 하나뿐이면 제목 없이 한 묶음으로 둔다', () => {
  const groups = groupWinnersByDraw([drawWinner(1, 0, 1), drawWinner(2, 0, 2)])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].title, null)
  assert.equal(groups[0].caption, null)
  assert.deepEqual(groups[0].winners.map((winner) => winner.winnerId), [1, 2])
})

test('최초 추첨과 재추첨이 함께 있으면 회차별로 나누고 순위가 겹쳐도 구분한다', () => {
  const groups = groupWinnersByDraw([drawWinner(1, 0, 1), drawWinner(2, 0, 2), drawWinner(3, 1, 1)])
  assert.deepEqual(groups.map((group) => group.title), ['최초 추첨', '재추첨'])
  assert.equal(groups[0].caption, null)
  assert.equal(groups[1].caption, '결원이 생겨 다시 추첨했어요.')
  assert.deepEqual(groups.map((group) => group.winners.map((winner) => winner.rankInDrawing)), [[1, 2], [1]])
})

test('재추첨이 여러 번이면 차수를 붙이고, 입력 순서가 섞여도 회차·순위 순으로 정렬한다', () => {
  const groups = groupWinnersByDraw([drawWinner(5, 2, 1), drawWinner(2, 0, 2), drawWinner(4, 1, 1), drawWinner(1, 0, 1)])
  assert.deepEqual(groups.map((group) => group.title), ['최초 추첨', '1차 재추첨', '2차 재추첨'])
  assert.deepEqual(groups[0].winners.map((winner) => winner.winnerId), [1, 2])
})

test('회차 번호가 없는 응답은 최초 회차로 묶고, 목록이 없으면 빈 배열이다', () => {
  assert.deepEqual(groupWinnersByDraw([{ winnerId: 1, rankInDrawing: 1 }]).map((group) => group.drawNo), [0])
  assert.deepEqual(groupWinnersByDraw(undefined), [])
  assert.deepEqual(groupWinnersByDraw([]), [])
})
