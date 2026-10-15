import test from 'node:test'
import assert from 'node:assert/strict'
import { SPACE_BANNER_IMAGE_LIMITS, validateBannerImage, validateImageFile } from '../src/utils/imageValidation.js'
import { spaceUpdateBody } from '../src/utils/spaceProfile.js'

const MB = 1024 * 1024
const png = (size = 1024) => ({ type: 'image/png', size })
const sizeOf = (width, height) => async () => ({ width, height })

const base = { introText: '소개', profileImageUrl: 'https://cdn.example.com/p.png', bannerImageUrl: 'https://cdn.example.com/b.png' }

test('배너 제한값은 BE space-api.md와 같다(5MB, 600×200px)', () => {
  assert.deepEqual(SPACE_BANNER_IMAGE_LIMITS, { maxBytes: 5 * MB, minWidth: 600, minHeight: 200 })
})

test('배너는 600×200px 이상이면 통과하고 가로세로 비율은 보지 않는다', async () => {
  assert.equal(await validateBannerImage(png(), sizeOf(600, 200)), null)
  assert.equal(await validateBannerImage(png(), sizeOf(3000, 200)), null)
  assert.equal(await validateBannerImage(png(), sizeOf(600, 2000)), null)
  assert.equal(await validateBannerImage({ type: 'image/jpeg', size: 5 * MB }, sizeOf(1200, 400)), null)
})

test('배너 해상도가 가로 또는 세로 하나라도 모자라면 안내 문구를 돌려준다', async () => {
  assert.equal(await validateBannerImage(png(), sizeOf(599, 200)), '이미지는 600×200px 이상이어야 해요.')
  assert.equal(await validateBannerImage(png(), sizeOf(600, 199)), '이미지는 600×200px 이상이어야 해요.')
})

test('배너도 형식·용량·손상 파일을 올리기 전에 거른다', async () => {
  assert.match(await validateBannerImage({ type: 'image/gif', size: 1024 }, sizeOf(1200, 400)), /JPEG 또는 PNG/)
  assert.match(await validateBannerImage(png(5 * MB + 1), sizeOf(1200, 400)), /5MB 이하/)
  assert.match(await validateBannerImage(png(), async () => null), /읽을 수 없어요/)
})

test('배너도 MIME이 비거나 octet-stream인 JPEG·PNG는 확장자로 보조 판정하고, 그 밖은 거부한다', async () => {
  const size = sizeOf(1200, 400)
  assert.equal(await validateBannerImage({ name: 'banner.PNG', type: '', size: 1024 }, size), null)
  assert.equal(await validateBannerImage({ name: 'banner.jpg', type: 'application/octet-stream', size: 1024 }, size), null)
  assert.match(await validateBannerImage({ name: 'banner.png.exe', type: '', size: 1024 }, size), /JPEG 또는 PNG/)
  assert.match(await validateBannerImage({ name: 'banner.png', type: 'image/gif', size: 1024 }, size), /JPEG 또는 PNG/)
})

test('같은 검증 함수에 프로필 사진 제한(200×200px)을 주면 그 기준으로 판단한다', async () => {
  const limits = { maxBytes: 5 * MB, minWidth: 200, minHeight: 200 }
  assert.equal(await validateImageFile(png(), limits, sizeOf(200, 200)), null)
  assert.equal(await validateImageFile(png(), limits, sizeOf(199, 400)), '이미지는 200×200px 이상이어야 해요.')
})

test('배너를 바꾸지 않으면 bannerImageKey를 보내지 않아 BE가 현재 배너를 유지한다', () => {
  const body = spaceUpdateBody({ ...base, bannerImageKey: undefined })
  assert.equal('bannerImageKey' in body, false)
  assert.deepEqual(body, base)
})

test('새로 올린 배너는 key로, 기본 배너 복귀는 null로 보낸다', () => {
  const key = 'creator-space-profile-images/42/banner/uuid.jpg'
  assert.equal(spaceUpdateBody({ ...base, bannerImageKey: key }).bannerImageKey, key)
  const reset = spaceUpdateBody({ ...base, bannerImageKey: null })
  assert.equal('bannerImageKey' in reset, true)
  assert.equal(reset.bannerImageKey, null)
})

test('배너와 프로필 사진의 key는 서로 독립이다', () => {
  const body = spaceUpdateBody({ ...base, profileImageKey: null, bannerImageKey: 'k' })
  assert.equal(body.profileImageKey, null)
  assert.equal(body.bannerImageKey, 'k')
  const onlyBanner = spaceUpdateBody({ ...base, bannerImageKey: 'k' })
  assert.equal('profileImageKey' in onlyBanner, false)
})
