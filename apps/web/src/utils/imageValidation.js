import { isSupportedJpegOrPng } from './imageMime.js'

/** 스페이스 배너 업로드 제한(Cking-BE space-api.md와 같은 값). 가로세로 비율은 BE도 강제하지 않는다. 형식은 JPEG·PNG만(isSupportedJpegOrPng). */
export const SPACE_BANNER_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 600,
  minHeight: 200,
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

/** 스페이스 배너(600×200px 이상)를 올리기 전에 확인한다. */
export function validateBannerImage(file, readSize) {
  return validateImageFile(file, SPACE_BANNER_IMAGE_LIMITS, readSize)
}
