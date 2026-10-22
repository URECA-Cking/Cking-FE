import test from 'node:test'
import assert from 'node:assert/strict'
import { eventBannerSrc } from '../src/data/eventBanners.js'

// 이벤트 카드·상세의 배너: 올린 배너(bannerImageUrl)가 있으면 그 주소, 없거나 http(s)가 아니면 이벤트별 임시 그림이다(FE #401).
test('bannerImageUrl이 있으면 그 주소를 쓴다', () => {
  const url = 'https://dev-images.cking.co.kr/creator-space-profile-images/1/event-banner/a.jpg'
  assert.equal(eventBannerSrc({ eventId: 7, bannerImageUrl: url }), url)
})

test('bannerImageUrl이 없거나 안전하지 않으면 이벤트별 임시 그림으로 대신한다', () => {
  // blob:은 업로드 직후 미리보기용이라 서버가 준 주소로는 받지 않는다(web·admin 같은 기준).
  for (const bannerImageUrl of [null, undefined, '', 'javascript:alert(1)', 'not a url', 'blob:http://localhost/abc']) {
    assert.equal(eventBannerSrc({ eventId: 7, bannerImageUrl }), 'https://picsum.photos/seed/event-7/900/500')
  }
})
