/**
 * 저장 응답에서 그 저장이 담당하는 필드만 고른다. 스페이스 편집은 프로필(소개·이미지·배너), 공유 주소(slug), 활동명을 따로 저장한다.
 * 저장이 겹쳐 응답이 뒤늦게 도착해도 다른 저장이 먼저 바꾼 값을 옛 값으로 되돌리지 않도록, 각 저장은 자기 필드만 화면 상태에 넘긴다.
 * 응답에 없는 필드는 담지 않는다.
 */
export function pickFields(source, keys) {
  const picked = {}
  for (const key of keys) {
    if (source && source[key] !== undefined) picked[key] = source[key]
  }
  return picked
}

/**
 * PATCH /api/creator/space 요청 본문. 소개·프로필 이미지 URL·배너 이미지 URL은 모두 보내고(필수),
 * 프로필 사진은 `profileImageKey`, 배너는 `bannerImageKey`로 정한다. undefined면 필드를 보내지 않아 현재 이미지를 유지하고,
 * 새로 올린 key면 교체하고, null이면 Space의 기본 이미지·기본 배너로 돌아간다. 업로드한 이미지가 연결돼 있으면
 * BE가 `profileImageUrl`·`bannerImageUrl` 입력을 무시하고 현재 연결을 유지한다.
 */
export function spaceUpdateBody({ introText, profileImageUrl, bannerImageUrl, profileImageKey, bannerImageKey }) {
  const body = { introText, profileImageUrl, bannerImageUrl }
  if (profileImageKey !== undefined) body.profileImageKey = profileImageKey
  if (bannerImageKey !== undefined) body.bannerImageKey = bannerImageKey
  return body
}
