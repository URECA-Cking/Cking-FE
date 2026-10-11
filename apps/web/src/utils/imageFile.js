import { PROFILE_IMAGE_LIMITS } from '../api/profile.js'

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

/** 프로필 사진을 올리기 전에 형식·크기·해상도를 확인한다. 통과하면 null, 아니면 안내 문구. 최종 판단은 서버가 한다. */
export async function validateProfileImage(file) {
  if (!PROFILE_IMAGE_LIMITS.types.includes(file.type)) return 'JPEG 또는 PNG 이미지만 올릴 수 있어요.'
  if (file.size > PROFILE_IMAGE_LIMITS.maxBytes) return '이미지는 5MB 이하만 올릴 수 있어요.'
  const size = await readImageSize(file)
  if (!size) return '이미지를 읽을 수 없어요. 손상된 파일이 아닌지 확인해주세요.'
  if (size.width < PROFILE_IMAGE_LIMITS.minSize || size.height < PROFILE_IMAGE_LIMITS.minSize) {
    return `이미지는 ${PROFILE_IMAGE_LIMITS.minSize}×${PROFILE_IMAGE_LIMITS.minSize}px 이상이어야 해요.`
  }
  return null
}
