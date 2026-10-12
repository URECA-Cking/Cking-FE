/**
 * PATCH /api/creator/space 요청 본문. 소개·프로필 이미지 URL·배너 이미지 URL은 모두 보내고(필수),
 * 프로필 사진은 `profileImageKey`로 정한다. undefined면 필드를 보내지 않아 현재 사진을 유지하고,
 * 새로 올린 key면 교체하고, null이면 Space의 기본 이미지로 돌아간다. 업로드한 사진이 연결돼 있으면
 * BE가 `profileImageUrl` 입력을 무시하고 현재 연결을 유지한다.
 */
export function spaceUpdateBody({ introText, profileImageUrl, bannerImageUrl, profileImageKey }) {
  const body = { introText, profileImageUrl, bannerImageUrl }
  if (profileImageKey !== undefined) body.profileImageKey = profileImageKey
  return body
}
