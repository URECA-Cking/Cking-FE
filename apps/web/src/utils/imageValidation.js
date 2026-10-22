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

/**
 * 이벤트 배너 업로드 제한(Cking-BE event/banner-api.md와 같은 값). 지금은 스페이스 배너와 같지만 BE 정책이 따로라 따로 둔다.
 * 한쪽 BE 기준이 바뀌면 이 값만 맞추면 된다.
 */
export const EVENT_BANNER_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 600,
  minHeight: 200,
}

/** 이벤트 배너(600×200px 이상)를 올리기 전에 확인한다. */
export function validateEventBannerImage(file, readSize) {
  return validateImageFile(file, EVENT_BANNER_IMAGE_LIMITS, readSize)
}
