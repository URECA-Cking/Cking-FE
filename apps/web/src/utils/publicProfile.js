// 크리에이터 계정의 공개 프로필 규칙(Cking-BE #624). 팬은 Member 닉네임·사진이 공개 프로필이고,
// 승인된 크리에이터는 활동명·Creator Space 사진이 공개 프로필이다. 화면과 분리해 테스트로 보호한다.
import { displayNickname } from './nickname.js'

/** 로그인한 계정이 승인된 크리에이터인지. GET /api/me의 `creator` 필드로 판단한다. */
export function isCreatorAccount(user) {
  return Boolean(user?.creator)
}

/**
 * Member 닉네임 설정이 필요한 계정인지. 크리에이터는 활동명이 공개 이름이라 Member 닉네임을 설정할 수 없고(BE가 막는다) 필요하지도 않다.
 * 닉네임 필드를 내려주지 않는 구버전 BE(`profileConfigured` 자체가 없음)는 설정이 필요하다고 단정하지 않는다.
 */
export function needsNicknameSetup(user) {
  return user?.profileConfigured === false && !isCreatorAccount(user)
}

/**
 * 마이페이지 등에서 "내 프로필"로 보여 줄 이름·사진.
 * 크리에이터는 스페이스 응답(`creatorName` 활동명, `profileImageUrl`)을 쓴다. 스페이스를 받지 못했으면 이름은 활동명 응답으로 대신하고,
 * 둘 다 없으면 이름·사진을 null로 두어 Member 닉네임이 잠깐 보였다가 바뀌는 일이 없게 한다. 팬은 Member 닉네임·사진이다.
 *
 * @param {{ creator?: unknown, nickname?: string | null, profileImageUrl?: string | null } | null} user
 * @param {{ creatorName?: string | null, profileImageUrl?: string | null } | null | undefined} space 내 스페이스(GET /api/creator/space)
 * @param {{ activityName?: string | null } | null | undefined} creatorProfile 내 활동명(GET /api/creator/profile). 스페이스가 없을 때만 이름에 쓴다
 * @returns {{ name: string | null, photo: string | null, creator: boolean }}
 */
export function ownPublicProfile(user, space, creatorProfile) {
  if (isCreatorAccount(user)) {
    return {
      name: space?.creatorName ?? creatorProfile?.activityName ?? null,
      photo: space?.profileImageUrl ?? null,
      creator: true,
    }
  }
  return { name: displayNickname(user), photo: user?.profileImageUrl ?? null, creator: false }
}

/** 크리에이터가 활동명을 아직 정하지 않았는지. 내 프로필 응답(GET /api/creator/profile)이 없으면 알 수 없으므로 false다. */
export function activityNameMissing(creatorProfile) {
  return creatorProfile?.activityNameConfigured === false
}

/**
 * 내 스페이스를 열면서 스페이스 편집 시트까지 띄우라는 화면 이동 상태. 마이페이지와 오류 안내가 같은 값을 쓴다.
 * CreatorSpace가 읽고, 시트를 연 뒤에는 상태에서 지운다.
 */
export const OPEN_SPACE_EDIT_STATE = Object.freeze({ tab: 'home', openSpaceEdit: true })
