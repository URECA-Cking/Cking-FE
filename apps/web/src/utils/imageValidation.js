import { readImageSize, validateImageFile } from '@cking/shared/imageValidation'

export { readImageSize, validateImageFile }

/** 스페이스 배너 업로드 제한(Cking-BE space-api.md와 같은 값). 가로세로 비율은 BE도 강제하지 않는다. 형식은 JPEG·PNG만(isSupportedJpegOrPng). */
export const SPACE_BANNER_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 600,
  minHeight: 200,
}

/** 스페이스 배너(600×200px 이상)를 올리기 전에 확인한다. */
export function validateBannerImage(file, readSize) {
  return validateImageFile(file, SPACE_BANNER_IMAGE_LIMITS, readSize)
}
