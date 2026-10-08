import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import CreatorAvatarItem from '../creator/CreatorAvatarItem.jsx'

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000

/** 읽음 상태를 주는 API가 없어 "최근 24시간 안의 글"을 NEW로 본다. 표시 힌트일 뿐 업무 판정이 아니다. */
function isRecent(iso) {
  const time = new Date(iso).getTime()
  return Number.isFinite(time) && Date.now() - time < NEW_WINDOW_MS
}

/** 최신 글이 있는 크리에이터를 앞으로, 나머지는 기존 순서를 유지한다. */
function sortByLatestPost(creators, latestByCreator) {
  const timeOf = (creator) => {
    const time = new Date(latestByCreator.get(creator.creatorId)?.createdAt).getTime()
    return Number.isFinite(time) ? time : 0
  }
  return [...creators].sort((a, b) => timeOf(b) - timeOf(a))
}

/** 홈 최상단: 팔로우한 크리에이터를 가로 스토리 행으로. 새 글이 있으면 링 색으로만 알린다. */
export default function NewsRow({ creators, latestByCreator }) {
  if (creators.length === 0) {
    return (
      <Link to="/onboarding/creators" className="mx-margin mt-4 flex items-center justify-between gap-3 py-3 border-y border-on-surface/10">
        <span className="min-w-0">
          <span className="block font-label-md text-label-md text-on-surface line-clamp-2">관심 있는 크리에이터를 팔로우해보세요</span>
          <span className="block font-label-sm text-label-sm text-on-surface-variant font-normal line-clamp-2">새 소식이 여기에 모여요.</span>
        </span>
        <MaterialIcon name="chevron_right" className="text-outline shrink-0" />
      </Link>
    )
  }

  return (
    <div className="mt-3">
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain touch-pan-x px-margin pt-3 no-scrollbar">
        {sortByLatestPost(creators, latestByCreator).map((creator) => {
          const post = latestByCreator.get(creator.creatorId)
          return <CreatorAvatarItem key={creator.creatorId} creator={creator} isNew={Boolean(post) && isRecent(post.createdAt)} />
        })}
        <Link
          to="/onboarding/creators"
          aria-label="크리에이터 추가"
          className="flex flex-col items-center flex-shrink-0 w-16"
        >
          <span className="w-12 h-12 rounded-full border border-dashed border-on-surface/20 flex items-center justify-center text-outline">
            <MaterialIcon name="add" className="text-[22px]" />
          </span>
        </Link>
      </div>
    </div>
  )
}
