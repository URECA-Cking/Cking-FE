import { bannerImage } from './images.js'

// 이벤트 응답에는 배너 이미지가 없어 화면용 배경을 생성한다.
export function getEventBanner(eventId) {
  return bannerImage(`event-${eventId}`, 900, 500)
}
