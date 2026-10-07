import { apiClient } from './client';

// Creator Space API(Cking-BE docs/domains/creator/space-api.md).
// 공개 조회 응답: { creatorId, creatorName, slug, introText, profileImageUrl, bannerImageUrl }
// 본인 API 응답: 위 필드 + slugChangeableAt(다음 slug 변경 가능 시각, 한 번도 안 바꿨으면 null)

// GET /api/creators/{creatorId}/space - creatorId로 공개 조회(앱 안 이동)
export async function getCreatorSpace(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/space`);
}

// GET /api/creator-spaces/{slug} - slug로 공개 조회(공유 링크 /space/{slug})
export async function getCreatorSpaceBySlug(slug) {
  return apiClient.get(`/api/creator-spaces/${encodeURIComponent(slug)}`);
}

// GET /api/creator/space - 내 Space 조회(Creator 본인)
export async function getMySpace() {
  return apiClient.get('/api/creator/space');
}

// PATCH /api/creator/space - 내 Space 홈·프로필 수정(모든 필드를 한 번에 교체)
export async function updateMySpace({ introText, profileImageUrl, bannerImageUrl }) {
  return apiClient.patch('/api/creator/space', { introText, profileImageUrl, bannerImageUrl });
}

// PATCH /api/creator/space/slug - 내 Space slug 변경
export async function changeMySpaceSlug(slug) {
  return apiClient.patch('/api/creator/space/slug', { slug });
}

/** slug 변경 오류 코드별 안내(Cking-BE docs/domains/creator/space-slug-policy.md). */
export const SLUG_ERROR_MESSAGES = {
  VALIDATION_FAILED: 'slug는 3~30자의 소문자·숫자·하이픈(-)·밑줄(_)이며, 처음과 끝은 소문자나 숫자여야 해요.',
  RESERVED_SLUG: '사용할 수 없는 slug예요. 다른 값을 입력해주세요.',
  SLUG_ALREADY_TAKEN: '이미 사용 중이거나 다른 크리에이터가 잠시 보관 중인 slug예요.',
  SLUG_CHANGE_TOO_SOON: 'slug는 마지막 변경 후 14일이 지나야 다시 바꿀 수 있어요.',
};

/** 공유 링크(/space/{slug}) 전체 주소. */
export function spaceShareUrl(slug) {
  return `${window.location.origin}/space/${encodeURIComponent(slug)}`;
}
