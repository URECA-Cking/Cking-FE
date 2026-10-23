import { ApiError, apiClient, describeError } from './client';
import { spaceUpdateBody } from '../utils/spaceProfile.js';

// Creator Space API(Cking-BE docs/domains/creator/space-api.md).
// 공개 조회 응답: { creatorId, creatorName, slug, introText, profileImageUrl, bannerImageUrl }
// 본인 API 응답: 위 필드 + slugChangeableAt(다음 slug 변경 가능 시각, 한 번도 안 바꿨으면 null)

// GET /api/creators/{creatorId}/space - creatorId로 공개 조회(앱 안 이동)
export async function getCreatorSpace(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/space`);
}

// GET /api/creator-spaces/{slug} - slug로 공개 조회(공유 링크 /{slug})
export async function getCreatorSpaceBySlug(slug) {
  return apiClient.get(`/api/creator-spaces/${encodeURIComponent(slug)}`);
}

// GET /api/creator/space - 내 Space 조회(Creator 본인)
export async function getMySpace() {
  return apiClient.get('/api/creator/space');
}

// PATCH /api/creator/space - 내 Space 홈·프로필 수정(모든 필드를 한 번에 교체)
export async function updateMySpace(fields) {
  return apiClient.patch('/api/creator/space', spaceUpdateBody(fields));
}

// POST /api/creator/space/profile-images - 프로필 사진 1장 업로드 → { imageKey }. 24시간 안에 연결하지 않으면 서버가 지운다.
export function uploadSpaceProfileImage(file) {
  const form = new FormData();
  form.append('image', file);
  return apiClient.post('/api/creator/space/profile-images', form);
}

// POST /api/creator/space/banner-images - 배너 이미지 1장 업로드 → { imageKey }. 24시간 안에 연결하지 않으면 서버가 지운다.
export function uploadSpaceBannerImage(file) {
  const form = new FormData();
  form.append('image', file);
  return apiClient.post('/api/creator/space/banner-images', form);
}

/** 스페이스 프로필 사진·배너 업로드·저장 오류 코드별 문구. 모르는 코드는 공통 문구나 대체 문구로 대신한다. */
export const SPACE_IMAGE_ERROR_MESSAGES = {
  INVALID_SPACE_PROFILE_IMAGE: '이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 200×200px 이상인지 확인하고 사진을 다시 올려주세요.',
  INVALID_SPACE_BANNER_IMAGE: '배너 이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 600×200px 이상인지 확인하고 배너를 다시 올려주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  IMAGE_PROCESSING_BUSY: '지금 사진을 처리하는 요청이 많아요. 잠시 뒤에 다시 시도해주세요.',
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 소개와 이미지 주소는 비워둘 수 없고 500자 이하여야 해요.',
};

export function describeSpaceImageError(error, fallback) {
  if (error instanceof ApiError && SPACE_IMAGE_ERROR_MESSAGES[error.code]) return SPACE_IMAGE_ERROR_MESSAGES[error.code];
  return describeError(error, fallback);
}

// PATCH /api/creator/space/slug - 내 Space slug 변경
export async function changeMySpaceSlug(slug) {
  return apiClient.patch('/api/creator/space/slug', { slug });
}

/** slug 변경 오류 코드별 안내(Cking-BE docs/domains/creator/space-slug-policy.md). */
export const SLUG_ERROR_MESSAGES = {
  VALIDATION_FAILED: '공유 주소는 3~30자의 소문자·숫자·하이픈(-)·밑줄(_)이며, 처음과 끝은 소문자나 숫자여야 해요.',
  RESERVED_SLUG: '사용할 수 없는 공유 주소예요. 다른 값을 입력해주세요.',
  SLUG_ALREADY_TAKEN: '이미 사용 중이거나 다른 크리에이터가 잠시 보관 중인 공유 주소예요.',
  SLUG_CHANGE_TOO_SOON: '공유 주소는 마지막 변경 후 14일이 지나야 다시 바꿀 수 있어요.',
};

/** 크리에이터 스페이스 경로. 인스타처럼 /{slug}. 예전 공유 링크 /space/{slug}도 계속 열린다. */
export function spacePath(slug) {
  return `/${encodeURIComponent(slug)}`;
}

/** 공유 링크(/{slug}) 전체 주소. */
export function spaceShareUrl(slug) {
  return `${window.location.origin}${spacePath(slug)}`;
}
