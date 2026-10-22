import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import CreatorAvatarItem from '../creator/CreatorAvatarItem.jsx'
import { sortCreatorsByLatestPost } from '../../utils/followPostNews.js'

const NO_UNREAD = new Set()
const NO_LATEST = new Map()

/** 홈 최상단: 팔로우한 크리에이터를 가로 스토리 행으로. 서버가 읽지 않은 새 글이 있다고 알린 크리에이터(unreadCreatorIds)는 링 색과 NEW 배지로 알린다. */
export default function NewsRow({ creators, latestByCreator, unreadCreatorIds = NO_UNREAD, latestPostAt = NO_LATEST }) {
  if (creators.length === 0) {
    return (
      <Link to="/onboarding/creators" className="mx-margin mt-4 flex items-center justify-between gap-3 py-3 border-y border-on-surface/10">
        <span className="min-w-0">
          <span className="block font-label-md text-label-md text-on-surface line-clamp-2">좋아하는 크리에이터에 도킹해 보세요</span>
          <span className="block font-label-sm text-label-sm text-on-surface-variant font-normal line-clamp-2">새 소식이 여기에 모여요.</span>
        </span>
        <MaterialIcon name="chevron_right" className="text-outline shrink-0" />
      </Link>
    )
  }

  return (
    <div className="mt-3">
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain touch-pan-x px-margin pt-3 no-scrollbar">
        {sortCreatorsByLatestPost(creators, latestByCreator, latestPostAt).map((creator) => {
          const isNew = unreadCreatorIds.has(creator.creatorId)
          return <CreatorAvatarItem key={creator.creatorId} creator={creator} isNew={isNew} latestPostId={isNew ? latestByCreator.get(creator.creatorId)?.postId : null} />
        })}
        <Link
          to="/onboarding/creators"
          aria-label="크리에이터 추가"
          className="flex flex-col items-center flex-shrink-0 w-[4.5rem]"
        >
          <span className="w-16 h-16 rounded-full border border-dashed border-on-surface/20 flex items-center justify-center text-outline">
            <MaterialIcon name="add" className="text-[22px]" />
          </span>
        </Link>
      </div>
    </div>
  )
}
