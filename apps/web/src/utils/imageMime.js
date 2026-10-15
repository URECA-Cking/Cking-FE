export const JPEG_PNG_IMAGE_TYPES = ['image/jpeg', 'image/png']

const SUPPORTED_MIME_TYPES = new Set(JPEG_PNG_IMAGE_TYPES)
const FALLBACK_MIME_TYPES = new Set(['', 'application/octet-stream'])
const SUPPORTED_FILENAME_PATTERN = /\.(?:jpe?g|png)$/i

/**
 * 브라우저가 JPEG/PNG의 MIME type을 비우거나 octet-stream으로 주는 경우에만
 * 파일명 확장자를 보조 신호로 사용한다. 실제 파일 형식은 서버가 최종 검증한다.
 */
export function isSupportedJpegOrPng(file) {
  const contentType = (file?.type ?? '').trim().toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(contentType)) return true
  if (!FALLBACK_MIME_TYPES.has(contentType)) return false
  return SUPPORTED_FILENAME_PATTERN.test((file?.name ?? '').trim())
}
