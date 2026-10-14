import test from 'node:test'
import assert from 'node:assert/strict'
import { canBlockAuthor, canDeleteComment, deleteRoute, moderationActor } from '../src/utils/commentModeration.js'

test('게시글 주인(크리에이터)이 우선이고, 아니면 관리자, 둘 다 아니면 조치 자격이 없다', () => {
  assert.equal(moderationActor({ isMine: true, isAdmin: false }), 'creator')
  assert.equal(moderationActor({ isMine: true, isAdmin: true }), 'creator')
  assert.equal(moderationActor({ isMine: false, isAdmin: true }), 'admin')
  assert.equal(moderationActor({ isMine: false, isAdmin: false }), null)
})

test('차단 메뉴는 로그인한 조치 자격자가 남의 댓글을 볼 때만 보이고 작성자 ID가 있어야 한다', () => {
  const base = { authenticated: true, actor: 'admin', isOwn: false, authorMemberId: 7 }
  assert.equal(canBlockAuthor(base), true)
  assert.equal(canBlockAuthor({ ...base, actor: 'creator' }), true)
  assert.equal(canBlockAuthor({ ...base, actor: null }), false)
  assert.equal(canBlockAuthor({ ...base, isOwn: true }), false)
  assert.equal(canBlockAuthor({ ...base, authenticated: false }), false)
  assert.equal(canBlockAuthor({ ...base, authorMemberId: null }), false)
  assert.equal(canBlockAuthor({ ...base, authorMemberId: undefined }), false)
})

test('삭제 버튼은 작성자 본인과 조치 자격자(크리에이터·관리자)에게 보인다', () => {
  assert.equal(canDeleteComment({ authenticated: true, actor: null, isOwn: true }), true)
  assert.equal(canDeleteComment({ authenticated: true, actor: 'admin', isOwn: false }), true)
  assert.equal(canDeleteComment({ authenticated: true, actor: 'creator', isOwn: false }), true)
  assert.equal(canDeleteComment({ authenticated: true, actor: null, isOwn: false }), false)
  assert.equal(canDeleteComment({ authenticated: false, actor: 'admin', isOwn: true }), false)
})

test('삭제 API는 본인 댓글이면 작성자 API, 남의 댓글이면 자격에 따라 관리자 또는 크리에이터 API를 쓴다', () => {
  assert.equal(deleteRoute({ actor: 'admin', isOwn: true }), 'author')
  assert.equal(deleteRoute({ actor: null, isOwn: true }), 'author')
  assert.equal(deleteRoute({ actor: 'admin', isOwn: false }), 'admin')
  assert.equal(deleteRoute({ actor: 'creator', isOwn: false }), 'creator')
})
