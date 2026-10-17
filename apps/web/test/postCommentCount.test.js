import test from 'node:test'
import assert from 'node:assert/strict'
import { adjustCommentCount, applyCommentCount, displayedCommentTotal, reconcileCommentCounts } from '../src/utils/postCommentCount.js'

test('처음 등록하면 서버가 준 수에 1을 더하고, 이어 등록하면 보정한 값에 더한다', () => {
  const first = adjustCommentCount({}, 7, 3, 1)
  assert.deepEqual(first, { 7: 4 })
  assert.deepEqual(adjustCommentCount(first, 7, 3, 1), { 7: 5 })
})

test('삭제하면 1을 빼고 0 아래로 내려가지 않는다', () => {
  assert.deepEqual(adjustCommentCount({}, 7, 3, -1), { 7: 2 })
  assert.deepEqual(adjustCommentCount({}, 7, 0, -1), { 7: 0 })
})

test('서버 수를 모르면 보정하지 않고 다른 게시글의 보정값은 건드리지 않는다', () => {
  const overrides = { 1: 9 }
  assert.equal(adjustCommentCount(overrides, 7, undefined, 1), overrides)
  assert.equal(adjustCommentCount(overrides, 7, null, 1), overrides)
  assert.deepEqual(adjustCommentCount(overrides, 7, 3, 1), { 1: 9, 7: 4 })
})

test('보정값이 있는 게시글만 댓글 수를 덮어쓰고 0도 보정값으로 인정한다', () => {
  const post = { postId: 7, commentCount: 3, likeCount: 2 }
  assert.equal(applyCommentCount(post, {}), post)
  assert.deepEqual(applyCommentCount(post, { 7: 4 }), { postId: 7, commentCount: 4, likeCount: 2 })
  assert.equal(applyCommentCount(post, { 7: 0 }).commentCount, 0)
})

test('새 목록에 게시글이 있으면 보정값을 버리고 서버 값을 상세에 돌려준다', () => {
  // 화면에서 3→4로 보정했는데 서버 재조회 결과가 5면 5가 보여야 한다.
  const result = reconcileCommentCounts({ 7: 4, 8: 2 }, 7, [{ postId: 7, commentCount: 5 }, { postId: 8, commentCount: 2 }])
  assert.deepEqual(result, { overrides: {}, detailCount: 5 })
})

test('열린 상세 게시글이 새 목록에 없을 때만 그 보정값을 남기고 나머지는 버린다', () => {
  assert.deepEqual(reconcileCommentCounts({ 7: 4, 8: 2 }, 7, [{ postId: 8, commentCount: 2 }]), { overrides: { 7: 4 }, detailCount: undefined })
  assert.deepEqual(reconcileCommentCounts({ 8: 2 }, 7, []), { overrides: {}, detailCount: undefined })
})

test('열린 상세가 없으면 보정값을 모두 버린다', () => {
  assert.deepEqual(reconcileCommentCounts({ 7: 4 }, null, [{ postId: 7, commentCount: 5 }]), { overrides: {}, detailCount: undefined })
})

test('새 목록의 댓글 수를 모르면 보정값을 서버 값으로 대신하지 않고 남긴다', () => {
  assert.deepEqual(reconcileCommentCounts({ 7: 4 }, 7, [{ postId: 7 }]), { overrides: { 7: 4 }, detailCount: undefined })
})

test('머리글 댓글 수는 지운 댓글을 빼고 서버가 아직 세지 않은 새 댓글만 더한다', () => {
  const none = { created: [], deleted: [], counted: [] }
  assert.equal(displayedCommentTotal(5, none), 5)
  assert.equal(displayedCommentTotal(5, { ...none, created: [{ commentId: 1 }] }), 6)
  // 재조회한 서버 전체 수가 이미 센 댓글은 다시 더하지 않는다.
  assert.equal(displayedCommentTotal(6, { created: [{ commentId: 1 }], deleted: [], counted: [1] }), 6)
  assert.equal(displayedCommentTotal(5, { ...none, deleted: [9] }), 4)
})

test('삭제에 성공한 댓글과 이미 삭제돼 404를 받은 댓글은 머리글과 부모 보정이 같은 만큼 줄어든다', () => {
  // PostComments는 두 경우 모두 deleted에 넣고 onCommentCountChange(-1)을 부르므로 상세 안의 두 수가 같다.
  const deleted = { created: [], deleted: [11], counted: [] }
  const header = displayedCommentTotal(3, deleted)
  assert.equal(header, 2)
  assert.deepEqual(adjustCommentCount({}, 7, 3, -1), { 7: header })
})
