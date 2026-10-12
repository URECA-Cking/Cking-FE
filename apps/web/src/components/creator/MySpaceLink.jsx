import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getMySpace, spacePath } from '../../api/creatorSpace.js'

/**
 * Creator 본인의 Space로 가는 링크. GET /api/creator/space로 내 creatorId를 알아낸다.
 * Space가 아직 없으면(RESOURCE_NOT_FOUND 등) 이동할 수 없다는 안내만 보여준다. 마이페이지 메뉴 행으로 쓴다.
 */
export default function MySpaceLink() {
  const { data: space, loading, error } = useAsync(() => getMySpace(), [], {
    fallbackMessage: '내 스페이스를 불러오지 못했어요.',
  })

  const rowClass = 'flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high'
  if (loading || error || !space) {
    return (
      <div className={`${rowClass} opacity-60`}>
        <MaterialIcon name="storefront" className="text-primary text-[20px]" />
        <span className="font-label-md text-label-md text-on-surface flex-1">내 스페이스</span>
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          {loading ? '확인 중...' : '아직 준비되지 않았어요'}
        </span>
      </div>
    )
  }
  return (
    <Link to={spacePath(space.slug)} className={rowClass}>
      <MaterialIcon name="storefront" className="text-primary text-[20px]" />
      <span className="font-label-md text-label-md text-on-surface flex-1">내 스페이스</span>
      <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
    </Link>
  )
}
