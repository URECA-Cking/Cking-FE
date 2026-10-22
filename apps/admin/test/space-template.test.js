import test from 'node:test'
import assert from 'node:assert/strict'
import { previewSlug, templateFields, toTemplateRequest, validateTemplate } from '../src/utils/spaceTemplate.js'

const valid = {
  introText: '크리에이터와 함께하는 공간이에요',
  profileImageUrl: 'https://cdn.example.com/default/profile.png',
  bannerImageUrl: 'https://cdn.example.com/default/banner.png',
  slugRule: 'creator-{creatorId}',
}

test('네 필드를 모두 채우고 규칙을 지키면 오류가 없다', () => {
  assert.deepEqual(validateTemplate(valid), {})
})

test('빈 값과 공백뿐인 값은 필수 오류다', () => {
  const errors = validateTemplate(templateFields(null))
  assert.deepEqual(Object.keys(errors).sort(), ['bannerImageUrl', 'introText', 'profileImageUrl', 'slugRule'])
  assert.ok(validateTemplate({ ...valid, introText: '   ' }).introText)
})

test('길이 제한을 넘으면 오류다', () => {
  assert.ok(validateTemplate({ ...valid, introText: 'a'.repeat(501) }).introText)
  assert.equal(validateTemplate({ ...valid, introText: 'a'.repeat(500) }).introText, undefined)
  assert.ok(validateTemplate({ ...valid, profileImageUrl: `https://x.test/${'a'.repeat(500)}` }).profileImageUrl)
  assert.ok(validateTemplate({ ...valid, slugRule: `${'a'.repeat(93)}{creatorId}` }).slugRule)
})

test('slugRule은 맨 끝에 {creatorId}가 한 번 오는 소문자·숫자·하이픈 접두사만 허용한다', () => {
  for (const slugRule of ['{creatorId}', 'creator-{creatorId}', 'c-a-b-{creatorId}', 'abc{creatorId}', 'a1b-{creatorId}', 'creator-1-{creatorId}']) {
    assert.equal(validateTemplate({ ...valid, slugRule }).slugRule, undefined, slugRule)
  }
  for (const slugRule of ['creator', 'creator-', '{creatorId}-x', 'creator-{creatorId}{creatorId}', 'Creator-{creatorId}', 'creator_{creatorId}', 'creator1{creatorId}', 'creator {creatorId}']) {
    assert.ok(validateTemplate({ ...valid, slugRule }).slugRule, slugRule)
  }
})

test('요청 값은 앞뒤 공백을 걷어낸다', () => {
  assert.deepEqual(toTemplateRequest({ ...valid, slugRule: '  creator-{creatorId} ' }).slugRule, 'creator-{creatorId}')
})

test('slug 미리보기는 {creatorId}를 번호로 바꾸고 유효하지 않으면 null이다', () => {
  assert.equal(previewSlug('creator-{creatorId}'), 'creator-1')
  assert.equal(previewSlug('creator-{creatorId}', 42), 'creator-42')
  assert.equal(previewSlug('creator'), null)
  assert.equal(previewSlug(''), null)
})
