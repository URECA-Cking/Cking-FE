import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../context/useToast.js'
import { isProfileSetupRequired } from '../api/profile.js'

/**
 * 닉네임을 설정하지 않은 회원이 공개 활동(댓글 작성·수정, 크리에이터 신청, 이벤트 응모)을 하면 BE가
 * `PROFILE_SETUP_REQUIRED`(409)로 막는다. 그 오류(ApiError 또는 응모 envelope)를 받았을 때 안내 후 프로필 설정 화면으로 보낸다.
 * 설정을 마치면 원래 있던 화면으로 돌아온다.
 *
 * @returns {(error: unknown) => boolean} 프로필 설정이 필요한 오류라 화면을 옮겼으면 true. 호출한 쪽은 그때 자기 오류 처리를 건너뛴다.
 */
export function useProfileSetupRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  return useCallback((error) => {
    if (!isProfileSetupRequired(error)) return false
    showToast('먼저 닉네임을 설정해주세요.', { icon: 'error' })
    navigate('/profile/edit', { state: { from: location.pathname + location.search } })
    return true
  }, [navigate, location.pathname, location.search, showToast])
}
