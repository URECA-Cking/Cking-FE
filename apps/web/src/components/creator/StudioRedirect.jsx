import { Navigate, useLocation } from 'react-router-dom'
import { LoadingBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getMySpace, spacePath } from '../../api/creatorSpace.js'

/**
 * 예전 크리에이터 스튜디오 주소(/studio, /studio/calendar 등)를 내 스페이스로 보낸다.
 * 캘린더 주소는 캘린더 탭으로, 나머지는 이벤트 탭으로 열고, 스페이스를 찾지 못하면 마이페이지로 간다.
 */
export default function StudioRedirect() {
  const { pathname } = useLocation()
  const { data: space, loading, error } = useAsync(() => getMySpace(), [])

  if (loading) return <LoadingBlock label="내 스페이스로 이동하는 중..." />
  if (error || !space) return <Navigate to="/my-page" replace />
  const tab = pathname.startsWith('/studio/calendar') ? 'calendar' : 'events'
  return <Navigate to={spacePath(space.slug)} replace state={{ tab }} />
}
