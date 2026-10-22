import { bannerImage } from './images.js'
import { toSafeImageUrl } from '../utils/safeUrl.js'

/**
 * 이벤트 배너 주소. 크리에이터가 올린 배너(bannerImageUrl, Cking-BE #748)가 있으면 그 주소를 쓰고,
 * 없거나 http(s)가 아니면 이벤트마다 같은 그림이 나오는 임시 배경을 만든다.
 */
export function eventBannerSrc(event) {
  return toSafeImageUrl(event?.bannerImageUrl) ?? bannerImage(`event-${event?.eventId}`, 900, 500)
}
