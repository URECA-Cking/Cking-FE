import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

/** 크리에이터에게만 보이는 스튜디오 바로가기. 권한 분기는 UX용이고 최종 인가는 BE가 한다. */
export default function StudioLink() {
  return (
    <Link
      to="/studio"
      className="mx-margin mt-4 flex items-center justify-between py-2.5 border-y border-on-surface/10 font-label-md text-label-md text-on-surface active:opacity-80 transition-opacity"
    >
      <span className="flex items-center gap-2">
        <MaterialIcon name="storefront" className="text-[20px] text-primary" />
        내 스튜디오
      </span>
      <MaterialIcon name="chevron_right" className="text-outline" />
    </Link>
  )
}
