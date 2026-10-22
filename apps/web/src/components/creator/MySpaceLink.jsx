import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { spacePath } from '../../api/creatorSpace.js'

/**
 * Creator 본인의 Space로 가는 링크. 내 Space(GET /api/creator/space)는 마이페이지가 한 번 받아서 넘긴다.
 * Space가 아직 없으면(RESOURCE_NOT_FOUND 등) 이동할 수 없다는 안내만 보여준다. 마이페이지 메뉴 행으로 쓴다.
 *
 * @param {{ space: { slug: string } | null | undefined, loading: boolean, error: unknown }} props
 */
export default function MySpaceLink({ space, loading, error }) {
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
