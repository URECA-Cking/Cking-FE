import CreatorVerifiedBadge from '../ui/CreatorVerifiedBadge.jsx'
import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { spacePath } from '../../api/creatorSpace.js'

/**
 * 홈 "소식" 가로 행의 크리에이터 항목. 최근 글이 있으면(isNew) 링 색이 바뀌고 NEW 배지가 프로필 사진 위에 얹힌다.
 * isNew는 화면 힌트일 뿐이라 부모가 계산해 넘긴다(읽음 상태를 주는 API는 없다).
 * NEW이고 새 게시물 id(latestPostId)를 알면 그 게시물 상세를 연 채로 스페이스에 들어가고, 아니면 스페이스 홈으로 간다.
 * 새 소식 API는 글 id를 주지 않아 부모가 가진 최근 글 목록에서 찾으며, 목록에 없는 크리에이터는 스페이스로 폴백한다.
 */
export default function CreatorAvatarItem({ creator, isNew = false, latestPostId = null }) {
  const opensPost = isNew && latestPostId != null
  return (
    <Link
      to={spacePath(creator.handle)}
      state={opensPost ? { tab: 'posts', openPostId: latestPostId } : undefined}
      aria-label={isNew ? `${creator.name}, 새 소식` : creator.name}
      className="flex flex-col items-center flex-shrink-0 w-[4.5rem] group"
    >
      <span
        className={`relative block w-16 h-16 rounded-full p-0.5 border-2 group-active:scale-95 transition-transform ${
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
      <span className="mt-1.5 flex max-w-full items-center gap-1 font-label-sm text-label-sm text-on-surface-variant font-normal">
        <span className="truncate">{creator.name}</span>
        <CreatorVerifiedBadge />
      </span>
    </Link>
  )
}
