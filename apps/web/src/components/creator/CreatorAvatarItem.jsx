import CreatorVerifiedBadge from '../ui/CreatorVerifiedBadge.jsx'
import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { spacePath } from '../../api/creatorSpace.js'

/**
 * 홈 "소식" 가로 행의 크리에이터 항목. 최근 글이 있으면(isNew) 링 색이 바뀌고 NEW 배지가 프로필 사진 위에 얹힌다.
 * isNew는 화면 힌트일 뿐이라 부모가 계산해 넘긴다(읽음 상태를 주는 API는 없다).
 */
export default function CreatorAvatarItem({ creator, isNew = false }) {
  return (
    <Link
      to={spacePath(creator.handle)}
      aria-label={isNew ? `${creator.name}, 새 소식` : creator.name}
      className="flex flex-col items-center flex-shrink-0 w-16 group"
    >
      <span
        className={`relative block w-12 h-12 rounded-full p-0.5 border-2 group-active:scale-95 transition-transform ${
          isNew ? 'border-primary' : 'border-on-surface/10'
        }`}
      >
        {isNew && (
          <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-1.5 font-label-xs text-[10px] leading-4 text-on-primary">
            NEW
          </span>
        )}
        <ProfilePhoto src={creator.avatar} className="h-full w-full" />
      </span>
      <span className="mt-1 flex max-w-full items-center gap-1 font-label-sm text-label-sm text-on-surface-variant font-normal">
        <span className="truncate">{creator.name}</span>
        <CreatorVerifiedBadge />
      </span>
    </Link>
  )
}
