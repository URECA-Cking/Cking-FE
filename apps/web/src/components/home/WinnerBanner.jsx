import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getMyWinners } from '../../api/myWinners.js'

/**
 * 수령 대기(SELECTED) 중인 당첨이 있을 때만 홈 맨 위에 뜨는 한 줄 배너. 없거나 조회에 실패하면 아무것도 그리지 않는다.
 * 보조 안내라 실패를 오류 블록으로 알리지 않고, 당첨 확인은 내 당첨 화면에서 항상 할 수 있다.
 */
export default function WinnerBanner({ memberId }) {
  const { data } = useAsync(() => getMyWinners(), [memberId], { enabled: memberId != null })
  const pending = (data ?? []).filter((winner) => winner.winnerManagementStatus === 'SELECTED').length
  if (pending === 0) return null

  return (
    <Link
      to="/my-winners"
      className="mx-margin mt-4 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 active:opacity-80 transition-opacity"
    >
      <MaterialIcon name="emoji_events" filled className="text-[22px] text-primary shrink-0" />
      <p className="min-w-0 flex-1 font-label-md text-label-md text-on-surface line-clamp-2">
        당첨됐어요! 수령 대기 {pending}건
      </p>
      <MaterialIcon name="chevron_right" className="text-primary shrink-0" />
    </Link>
  )
}
