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

/** 이미지 파일의 가로·세로(px). 읽을 수 없으면 null이다. */
export function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

/**
 * 이미지를 올리기 전에 형식·크기·해상도를 확인한다. 통과하면 null, 아니면 안내 문구. 최종 판단은 서버가 한다.
 * readSize는 테스트에서 브라우저 없이 크기를 주입하기 위한 자리다.
 */
export async function validateImageFile(file, { maxBytes, minWidth, minHeight }, readSize = readImageSize) {
  if (!isSupportedJpegOrPng(file)) return 'JPEG 또는 PNG 이미지만 올릴 수 있어요.'
  if (file.size > maxBytes) return '이미지는 5MB 이하만 올릴 수 있어요.'
  const size = await readSize(file)
  if (!size) return '이미지를 읽을 수 없어요. 손상된 파일이 아닌지 확인해주세요.'
  if (size.width < minWidth || size.height < minHeight) return `이미지는 ${minWidth}×${minHeight}px 이상이어야 해요.`
  return null
}
