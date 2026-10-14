export const SUBSCRIPTION_VERIFICATION_IMAGE_TYPES = ['image/jpeg', 'image/png']

const SUPPORTED_MIME_TYPES = new Set(SUBSCRIPTION_VERIFICATION_IMAGE_TYPES)
const FALLBACK_MIME_TYPES = new Set(['', 'application/octet-stream'])
const SUPPORTED_FILENAME_PATTERN = /\.(?:jpe?g|png)$/i

/**
 * 브라우저가 실제 PNG/JPEG 파일의 MIME type을 비우거나 octet-stream으로 주는 경우에만
 * 파일명 확장자를 보조 신호로 사용한다. 실제 파일 형식과 해상도는 서버가 최종 검증한다.
 */
export function isSupportedSubscriptionVerificationImage(file) {
  const contentType = (file?.type ?? '').trim().toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(contentType)) return true
  if (!FALLBACK_MIME_TYPES.has(contentType)) return false
  return SUPPORTED_FILENAME_PATTERN.test((file?.name ?? '').trim())
}
