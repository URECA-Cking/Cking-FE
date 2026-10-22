import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeRecommendationProfile, recommendationEmptyMessage, currentSimilarCreators } from '../src/utils/recommendationProfile.js'

test('최신 소개와 이미지의 null 삭제를 반영하고 식별자와 링크는 유지한다', () => {
  const creator = { creatorId: 1, name: '기존 이름', handle: 'creator', bio: '이전 소개', avatar: 'old.png' }
  assert.deepEqual(mergeRecommendationProfile(creator, { creatorId: null, name: null, handle: null, bio: null, avatar: null }),
    { ...creator, bio: null, avatar: null })
  assert.deepEqual(mergeRecommendationProfile(creator, { name: '새 이름', bio: '', avatar: undefined }),
    { ...creator, name: '새 이름', bio: '' })
})

test('빈 결과는 관심 분야 선택 유무에 따라 안내한다', () => {
  assert.match(recommendationEmptyMessage(true), /선택한 관심 분야에 맞는/)
  assert.match(recommendationEmptyMessage(false), /관심 분야를 골라/)
})

test('회원 또는 seed 변경과 재조회·오류 중 이전 유사 목록을 숨긴다', () => {
  const creators = new Map([[2, { creatorId: 2 }]])
  const data = { owner: 1, seed: 10, items: [{ similarCreatorId: 2 }] }
  assert.equal(currentSimilarCreators(data, 1, 10, false, null, creators).length, 1)
  for (const args of [[2, 10, false, null], [1, 11, false, null], [1, 10, true, null], [1, 10, false, '실패']]) {
    assert.deepEqual(currentSimilarCreators(data, ...args, creators), [])
  }
})
