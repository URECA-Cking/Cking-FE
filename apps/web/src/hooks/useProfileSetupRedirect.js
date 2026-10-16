import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../context/useToast.js'
import { isProfileSetupRequired } from '../api/profile.js'
import { isActivityNameSetupRequired } from '../api/creatorProfile.js'
import { OPEN_SPACE_EDIT_STATE } from '../utils/publicProfile.js'

/**
 * 닉네임을 설정하지 않은 회원이 공개 활동(댓글 작성·수정, 크리에이터 신청, 이벤트 응모)을 하면 BE가
 * `PROFILE_SETUP_REQUIRED`(409)로 막는다. 그 오류(ApiError 또는 응모 envelope)를 받았을 때 안내 후 프로필 설정 화면으로 보낸다.
 * 설정을 마치면 원래 있던 화면으로 돌아온다.
 *
 * 승인된 크리에이터는 Member 닉네임 대신 활동명이 공개 이름이라, 활동명을 정하지 않았으면 같은 활동을 `ACTIVITY_NAME_SETUP_REQUIRED`(409)로
 * 막는다. 이때는 내 스페이스의 스페이스 편집(활동명 섹션)으로 보낸다(/studio가 내 스페이스를 찾아 시트를 연다).
 *
 * @returns {(error: unknown) => boolean} 프로필 설정이 필요한 오류라 화면을 옮겼으면 true. 호출한 쪽은 그때 자기 오류 처리를 건너뛴다.
 */
export function useProfileSetupRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  return useCallback((error) => {
    if (isActivityNameSetupRequired(error)) {
      showToast('먼저 활동명을 설정해주세요.', { icon: 'error' })
      navigate('/studio', { state: OPEN_SPACE_EDIT_STATE })
      return true
    }
    if (!isProfileSetupRequired(error)) return false
    showToast('먼저 닉네임을 설정해주세요.', { icon: 'error' })
    navigate('/profile/edit', { state: { from: location.pathname + location.search } })
    return true
  }, [navigate, location.pathname, location.search, showToast])
}
