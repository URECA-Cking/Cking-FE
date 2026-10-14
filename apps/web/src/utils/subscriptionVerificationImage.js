import { JPEG_PNG_IMAGE_TYPES, isSupportedJpegOrPng } from './imageMime.js'

export const SUBSCRIPTION_VERIFICATION_IMAGE_TYPES = JPEG_PNG_IMAGE_TYPES

/** 구독 인증도 Web 공통 JPEG/PNG MIME 보조 판정을 사용한다. */
export const isSupportedSubscriptionVerificationImage = isSupportedJpegOrPng
