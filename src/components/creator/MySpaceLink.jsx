import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getMySpace } from '../../api/creatorSpace.js'

/**
 * Creator 본인의 Space로 가는 링크. GET /api/creator/space로 내 creatorId를 알아낸다.
 * Space가 아직 없으면(RESOURCE_NOT_FOUND 등) 이동할 수 없다는 안내만 보여준다.
 *
 * @param {'row'|'button'} variant row: 마이페이지 메뉴 행, button: 스튜디오 버튼
 */
export default function MySpaceLink({ variant = 'row' }) {
  const { data: space, loading, error } = useAsync(() => getMySpace(), [], {
    fallbackMessage: '내 스페이스를 불러오지 못했어요.',
  })

  if (variant === 'button') {
    if (loading || error || !space) return null
    return (
      <Link
        to={`/creators/${space.creatorId}`}
        className="w-full h-12 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
      >
        <MaterialIcon name="storefront" className="text-[20px]" />내 스페이스 보기
      </Link>
    )
  }

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
    <Link to={`/creators/${space.creatorId}`} className={rowClass}>
      <MaterialIcon name="storefront" className="text-primary text-[20px]" />
      <span className="font-label-md text-label-md text-on-surface flex-1">내 스페이스</span>
      <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
    </Link>
  )
}
