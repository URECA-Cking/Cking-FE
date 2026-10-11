// 닉네임 입력 규칙(Cking-BE #518). 화면에서 먼저 안내하는 용도이며 최종 판단은 서버가 한다.
export const NICKNAME_MAX_LENGTH = 20

// 완성형 한글, 영문, 숫자, `_`, `-`만 허용한다. 공백·한글 자모 단독·전각 문자는 허용하지 않는다.
const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_-]+$/

export const NICKNAME_RULE_HINT = '1~20자, 한글·영문·숫자·_·-만 쓸 수 있어요. 공백은 쓸 수 없어요.'

/** 입력을 NFC로 정규화한 값. 서버도 NFC로 검증하므로 보내기 전에 같은 형태로 맞춘다. */
export function normalizeNickname(value) {
  return String(value ?? '').normalize('NFC')
}

/** 규칙을 어기면 안내 문구, 통과하면 null이다. 빈 값도 규칙 위반이다. */
export function validateNickname(value) {
  const nickname = normalizeNickname(value)
  if (nickname.length === 0) return '닉네임을 입력해주세요.'
  if (nickname.length > NICKNAME_MAX_LENGTH) return `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해주세요.`
  if (/\s/.test(nickname)) return '닉네임에는 공백을 쓸 수 없어요.'
  if (!NICKNAME_PATTERN.test(nickname)) return '한글·영문·숫자·_·-만 쓸 수 있어요. 자음·모음만 쓰거나 특수문자는 쓸 수 없어요.'
  return null
}

/** 프로필 사진 key 형식(`member-profile-images/{memberId}/{uuid}.jpg`)에서 URL 뒤쪽을 뽑는다. */
const IMAGE_KEY_PATTERN = /member-profile-images\/[^/?#]+\/[^/?#]+$/

/**
 * 현재 프로필 사진의 key. `GET /api/me`가 `profileImageKey`를 내려주면 그것을 쓰고, 없으면 고정 CDN URL의 끝부분에서 뽑는다.
 * 사진을 바꾸지 않고 저장할 때 `PUT /api/me/profile`에 현재 key를 다시 보내기 위해 필요하다. 사진이 없으면 null이다.
 */
export function currentImageKey(profile) {
  if (typeof profile?.profileImageKey === 'string') return profile.profileImageKey
  const url = profile?.profileImageUrl
  if (!url) return null
  return url.match(IMAGE_KEY_PATTERN)?.[0] ?? null
}

/**
 * 화면에 보일 내 닉네임. 닉네임이 없으면 null이다(OAuth 이름으로 대신하지 않는다).
 * 닉네임 필드를 아직 내려주지 않는 구버전 BE(`profileConfigured` 자체가 없음)에서는 기존처럼 `name`을 쓴다.
 */
export function displayNickname(user) {
  if (!user) return null
  if (user.nickname) return user.nickname
  return user.profileConfigured === undefined ? (user.name ?? null) : null
}
