import { parseServerTime } from './serverTime.js'

// Creator 활동명 규칙(Cking-BE docs/domains/creator/space-api.md). 형식·정규화는 Member 닉네임과 같아서
// 입력 검증은 utils/nickname.js의 validateNickname·normalizeNickname을 그대로 쓴다. 최종 판단은 서버가 한다.

/**
 * 활동명을 지금 바꿀 수 없는지. 마지막 실제 변경 뒤 14일 동안은 바꿀 수 없다(`activityNameChangeableAt`이 미래).
 * 최초 설정은 즉시 가능하므로 아직 설정하지 않은 상태(`activityNameConfigured === false`)는 잠기지 않는다.
 * 이전 활동명으로 되돌리기는 이 잠금과 관계없이 BE가 허용한다.
 *
 * @param {{ activityNameConfigured?: boolean, activityNameChangeableAt?: string | null } | null} profile
 */
export function isActivityNameLocked(profile, now = Date.now()) {
  if (!profile || profile.activityNameConfigured === false) return false
  const changeableAt = parseServerTime(profile.activityNameChangeableAt)
  return changeableAt !== null && now < changeableAt.getTime()
}
