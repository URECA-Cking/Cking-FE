// Creator Space 템플릿 입력 규칙(Cking-BE docs/domains/creator/space-template-api.md). 화면에서 먼저 안내하는 용도이며 최종 판단은 서버가 한다.

export const TEMPLATE_LIMITS = { introText: 500, profileImageUrl: 500, bannerImageUrl: 500, slugRule: 92 }

export const TEMPLATE_FIELD_LABELS = {
  introText: '기본 소개 문구',
  profileImageUrl: '기본 프로필 이미지 URL',
  bannerImageUrl: '기본 배너 이미지 URL',
  slugRule: '주소(slug) 규칙',
}

// 소문자·숫자·하이픈 접두사 뒤 맨 끝에 {creatorId}가 한 번 오고, 접두사가 있으면 마지막 글자는 숫자가 아니다.
// 그래야 slug 끝 숫자열이 곧 creatorId라서 규칙을 바꿔도 서로 다른 Creator의 slug가 겹치지 않는다.
const SLUG_RULE_PATTERN = /^(?:[a-z0-9-]*[a-z-])?\{creatorId\}$/

export const SLUG_RULE_HINT = '소문자·숫자·하이픈 접두사 뒤 맨 끝에 {creatorId}를 한 번 넣어요. 접두사의 마지막 글자는 숫자일 수 없어요. 예: creator-{creatorId}'

export function emptyTemplate() {
  return { introText: '', profileImageUrl: '', bannerImageUrl: '', slugRule: '' }
}

/** 서버 응답(또는 빈 값)에서 폼에 쓰는 네 필드만 뽑는다. */
export function templateFields(template) {
  return {
    introText: template?.introText ?? '',
    profileImageUrl: template?.profileImageUrl ?? '',
    bannerImageUrl: template?.bannerImageUrl ?? '',
    slugRule: template?.slugRule ?? '',
  }
}

/** 규칙을 어긴 필드의 안내 문구 모음. 모두 통과하면 빈 객체다. 서버와 같게 네 필드 모두 필수다. */
export function validateTemplate(fields) {
  const errors = {}
  for (const key of Object.keys(TEMPLATE_LIMITS)) {
    const value = String(fields?.[key] ?? '').trim()
    if (value.length === 0) errors[key] = `${TEMPLATE_FIELD_LABELS[key]}을(를) 입력해주세요.`
    else if (value.length > TEMPLATE_LIMITS[key]) errors[key] = `${TEMPLATE_FIELD_LABELS[key]}은(는) ${TEMPLATE_LIMITS[key]}자 이하로 입력해주세요.`
  }
  const slugRule = String(fields?.slugRule ?? '').trim()
  if (!errors.slugRule && !SLUG_RULE_PATTERN.test(slugRule)) errors.slugRule = SLUG_RULE_HINT
  return errors
}

/** 서버로 보낼 값. 앞뒤 공백을 걷어낸다. */
export function toTemplateRequest(fields) {
  return Object.fromEntries(Object.keys(TEMPLATE_LIMITS).map((key) => [key, String(fields?.[key] ?? '').trim()]))
}

/** 규칙이 유효할 때 실제 slug가 어떻게 만들어지는지 보여주는 예시. 유효하지 않으면 null이다. */
export function previewSlug(slugRule, creatorId = 1) {
  const rule = String(slugRule ?? '').trim()
  return SLUG_RULE_PATTERN.test(rule) ? rule.replace('{creatorId}', String(creatorId)) : null
}
