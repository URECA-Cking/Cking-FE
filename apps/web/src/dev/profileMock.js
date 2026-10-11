// 개발 전용 mock: Cking-BE #518·#519(닉네임·프로필 사진 API)가 준비되기 전에 프로필 편집 화면을 확인한다.
// 필드 이름과 오류 코드는 임시이며, 계약의 정본은 Cking-BE다. BE가 확정·배포되면 이 파일과 호출부를 지운다.
// 개발 서버(import.meta.env.DEV)에서 주소에 `?mock=1`을 붙였을 때만 동작한다. 기본은 실제 BE 응답 그대로다.
// 배포 빌드에서는 export가 null이라 mock 코드가 번들에서 빠진다.
//
// `?mock=1&profile=unset`이면 닉네임 미설정 상태로 시작하고, `profile=locked`이면 방금 바꿔서 14일 제한에 걸린 상태로 시작한다.

import { ApiError } from '@cking/shared/api'

const DAY = 24 * 60 * 60 * 1000

function createProfileMock() {
  const query = () => new URLSearchParams(window.location.search)
  const enabled = () => query().get('mock') === '1'

  let state = null
  // 올렸지만 아직 프로필에 저장하지 않은 사진(key와 미리보기 URL)
  let pending = null
  const taken = new Set(['admin', 'cking', 'yuni'])

  function init(me) {
    if (state) return state
    const mode = query().get('profile')
    state = {
      nickname: mode === 'unset' ? null : (me.name ?? '팬'),
      previousNickname: mode === 'locked' ? '이전닉네임' : null,
      changedAt: mode === 'locked' ? Date.now() - DAY : null,
      imageUrl: null,
      imageKey: null,
    }
    return state
  }

  const view = (me, current) => ({
    ...me,
    nickname: current.nickname,
    profileImageUrl: current.imageUrl,
    profileConfigured: current.nickname !== null,
    nicknameChangeableAt: current.changedAt ? new Date(current.changedAt + 14 * DAY).toISOString() : null,
    restorableNickname: current.changedAt && current.previousNickname ? current.previousNickname : null,
  })

  const fail = (code, status, message) => new ApiError(code, message, status)

  return {
    /** GET /api/me 응답에 프로필 필드를 채운다. BE가 값을 내려주면 그대로 둔다. */
    me(me) {
      if (!enabled() || !me || typeof me.profileConfigured === 'boolean') return me
      return view(me, init(me))
    },
    /** POST /api/me/profile-images */
    async upload(file) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const imageKey = `member-profile-images/mock/${crypto.randomUUID()}.jpg`
      pending = { imageKey, url: URL.createObjectURL(file) }
      return { imageKey }
    },
    /** PUT /api/me/profile — 전체 교체. 정책(14일·복귀·중복)은 BE #518과 같은 방향으로 흉내만 낸다. */
    async update(me, { nickname, profileImageKey }) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const current = init(me)
      let { nickname: name, previousNickname, changedAt } = current
      if (nickname !== name) {
        const restoring = previousNickname && nickname === previousNickname && changedAt
        const locked = name !== null && changedAt && Date.now() < changedAt + 14 * DAY
        if (!restoring && locked) throw fail('NICKNAME_CHANGE_TOO_SOON', 409, '닉네임은 마지막 변경 후 14일이 지나야 다시 바꿀 수 있어요.')
        if (!restoring && taken.has(nickname.toLowerCase())) throw fail('NICKNAME_ALREADY_TAKEN', 409, '이미 사용 중인 닉네임이에요.')
        if (restoring) {
          previousNickname = name
        } else if (name !== null) {
          previousNickname = name
          changedAt = Date.now()
        }
        name = nickname
      }
      let { imageUrl, imageKey } = current
      if (profileImageKey === null) {
        imageUrl = null
        imageKey = null
      } else if (profileImageKey !== imageKey && pending?.imageKey === profileImageKey) {
        imageUrl = pending.url
        imageKey = profileImageKey
      }
      state = { nickname: name, previousNickname, changedAt, imageUrl, imageKey }
      return view(me, state)
    },
  }
}

export const profileMock = import.meta.env.DEV ? createProfileMock() : null
