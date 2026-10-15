import { PROFILE_IMAGE_LIMITS } from '../api/profile.js'
import { readImageSize, validateBannerImage, validateImageFile } from './imageValidation.js'

export { readImageSize, validateBannerImage }

/** 프로필 사진(정사각 200px 이상)을 올리기 전에 확인한다. 통과하면 null, 아니면 안내 문구. 최종 판단은 서버가 한다. */
export function validateProfileImage(file, readSize) {
  const { maxBytes, minSize } = PROFILE_IMAGE_LIMITS
  return validateImageFile(file, { maxBytes, minWidth: minSize, minHeight: minSize }, readSize)
}
