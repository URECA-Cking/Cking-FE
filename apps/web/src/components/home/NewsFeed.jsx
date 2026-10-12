import { Link } from 'react-router-dom'
import { CreatorPhoto } from '../creator/CreatorAvatarItem.jsx'
import SectionTitle from './SectionTitle.jsx'
import { formatRelativeTime } from '../../utils/format.js'

// 한 번에 보여주는 카드 수. 가로로 넘겨 보므로 세로 공간은 늘지 않는다.
const FEED_LIMIT = 8

/** 본문이 없는 글(이미지만 있거나 잠긴 글)은 안내 문구로 대신한다. */
function snippetOf(post) {
  const text = post.content?.trim().replace(/\s+/g, ' ')
  if (text) return text
  return post.imageCount > 0 ? '사진을 올렸어요' : '새 글을 올렸어요'
}

/**
 * 팔로우한 크리에이터의 게시물을 최신순 가로 카드로. 카드를 누르면 그 크리에이터 스페이스의 게시물 탭으로 간다.
 * 이미 가져온 크리에이터별 최근 글을 그대로 쓰므로 추가 호출이 없다.
 */
export default function NewsFeed({ creators, posts }) {
  const creatorById = new Map(creators.map((creator) => [creator.creatorId, creator]))
  const cards = posts.filter((post) => creatorById.has(post.creatorId)).slice(0, FEED_LIMIT)
  if (cards.length === 0) return null

  return (
    <section className="mt-6">
      <div className="px-margin">
        <SectionTitle title="새 게시물" subtitle="팔로우한 크리에이터" />
      </div>
      <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain px-margin no-scrollbar">
        {cards.map((post) => {
          const creator = creatorById.get(post.creatorId)
          const thumb = post.images?.[0]?.url
          return (
            <Link
              key={post.postId}
              to={`/creators/${creator.creatorId}`}
              state={{ tab: 'posts' }}
              className="flex h-36 w-52 flex-shrink-0 flex-col rounded-2xl bg-surface-container p-3.5 active:opacity-80 transition-opacity"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="block h-6 w-6 flex-shrink-0 rounded-full overflow-hidden">
                  <CreatorPhoto src={creator.avatar} />
                </span>
                <span className="min-w-0 font-label-sm text-label-sm text-outline font-normal truncate">
                  <span className="text-on-surface font-semibold">{creator.name}</span> · {formatRelativeTime(post.createdAt)}
                </span>
              </span>
              <span className="mt-2 flex min-h-0 flex-1 items-start gap-2">
                <span
                  className={`min-w-0 flex-1 font-label-md text-label-md text-on-surface break-keep ${
                    thumb ? 'line-clamp-3' : 'line-clamp-4'
                  }`}
                >
                  {snippetOf(post)}
                </span>
                {thumb && <img className="h-14 w-14 flex-shrink-0 rounded-lg object-cover bg-surface-container-high" src={thumb} alt="" />}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
