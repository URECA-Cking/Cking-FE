import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_FOLLOW_POST_NEWS,
  buildFollowPostNews,
  pickCurrentFollowPostNews,
  sortCreatorsByLatestPost,
} from '../src/utils/followPostNews.js'

const items = [
  { creatorId: 1, hasUnreadPosts: true, latestPostCreatedAt: '2026-10-20T05:20:00Z' },
  { creatorId: 2, hasUnreadPosts: false, latestPostCreatedAt: null },
]
const state = { memberId: 7, idsKey: '1,2', loading: false, error: null }
const result = { memberId: 7, idsKey: '1,2', news: buildFollowPostNews(items) }

test('읽지 않은 글이 있는 크리에이터와 최신 글 시각만 담는다', () => {
  const news = buildFollowPostNews(items)
  assert.deepEqual([...news.unreadCreatorIds], [1])
  assert.deepEqual([...news.latestPostAt], [[1, Date.parse('2026-10-20T05:20:00Z')]])
})

test('조회 성공 결과는 같은 회원·팔로우 구성일 때만 쓴다', () => {
  assert.equal(pickCurrentFollowPostNews(result, state), result.news)
})

test('조회 중이거나 실패하면 이전 성공 값이 있어도 NEW를 숨긴다', () => {
  assert.equal(pickCurrentFollowPostNews(result, { ...state, loading: true }), EMPTY_FOLLOW_POST_NEWS)
  assert.equal(pickCurrentFollowPostNews(result, { ...state, error: '실패' }), EMPTY_FOLLOW_POST_NEWS)
  assert.equal(pickCurrentFollowPostNews(null, state), EMPTY_FOLLOW_POST_NEWS)
})

test('회원이 바뀌면 이전 회원의 결과를 쓰지 않는다', () => {
  assert.equal(pickCurrentFollowPostNews(result, { ...state, memberId: 8 }), EMPTY_FOLLOW_POST_NEWS)
})

test('팔로우 구성이 바뀌면 개수가 같아도 이전 결과를 쓰지 않는다', () => {
  assert.equal(pickCurrentFollowPostNews(result, { ...state, idsKey: '1,3' }), EMPTY_FOLLOW_POST_NEWS)
})

test('글 목록에 없는 11번째 이후 크리에이터도 post-news의 최신 글 시각으로 앞에 정렬한다', () => {
  const creators = Array.from({ length: 12 }, (_, index) => ({ creatorId: index + 1 }))
  const latestByCreator = new Map([[1, { createdAt: '2026-10-19T00:00:00Z' }]])
  const latestPostAt = new Map([[12, Date.parse('2026-10-20T00:00:00Z')]])
  const sorted = sortCreatorsByLatestPost(creators, latestByCreator, latestPostAt)
  assert.deepEqual(sorted.slice(0, 2).map((creator) => creator.creatorId), [12, 1])
  assert.deepEqual(sorted.slice(2).map((creator) => creator.creatorId), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})
