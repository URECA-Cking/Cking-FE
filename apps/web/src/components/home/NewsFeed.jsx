import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { spacePath } from '../../api/creatorSpace.js'
import SectionTitle from './SectionTitle.jsx'
import { formatNumber, formatRelativeTime } from '../../utils/format.js'

// 한 번에 보여주는 카드 수. 가로로 넘겨 보므로 세로 공간은 늘지 않는다.
const FEED_LIMIT = 8

/** 본문을 제목(첫 줄)과 부제(나머지)로 나눈다. 본문이 없는 글(이미지만 있거나 잠긴 글)은 안내 문구가 제목이 된다. */
function splitContent(post) {
  const lines = (post.content ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return { title: post.imageCount > 0 ? '사진을 올렸어요' : '새 글을 올렸어요', subtitle: '' }
  return { title: lines[0], subtitle: lines.slice(1).join(' ') }
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
        <SectionTitle title="새 게시물" subtitle="도킹한 크리에이터" />
      </div>
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain px-margin no-scrollbar">
        {cards.map((post) => {
          const creator = creatorById.get(post.creatorId)
          const { title, subtitle } = splitContent(post)
          const hasLikes = typeof post.likeCount === 'number'
          const hasComments = typeof post.commentCount === 'number'
          return (
            <Link
              key={post.postId}
              to={spacePath(creator.handle)}
              state={{ tab: 'posts' }}
              className="flex min-h-[7.5rem] w-44 flex-shrink-0 flex-col justify-between rounded-2xl border border-on-surface/10 bg-surface-container p-3.5 active:opacity-80 transition-colors"
            >
              <span className="min-w-0">
                <span className="mb-2.5 flex items-center gap-1.5 min-w-0">
                  <span className="block h-5 w-5 flex-shrink-0 rounded-full overflow-hidden">
                    <ProfilePhoto src={creator.avatar} className="h-full w-full" iconClassName="text-[14px]" loading="lazy" decoding="async" />
                  </span>
                  <span className="min-w-0 font-label-sm text-label-sm text-outline font-normal truncate">
                    <span className="text-on-surface font-semibold">{creator.name}</span> · {formatRelativeTime(post.createdAt)}
                  </span>
                </span>
                <span className="block font-label-md text-label-md font-extrabold text-on-surface break-keep line-clamp-2">{title}</span>
                {subtitle && <span className="mt-1 block font-label-sm text-label-sm text-on-surface-variant font-normal line-clamp-1">{subtitle}</span>}
              </span>
              {(hasLikes || hasComments) && (
                <span className="mt-2 flex items-center justify-between border-t border-on-surface/5 pt-2 font-label-sm text-[11px] text-outline font-normal">
                  <span className="flex items-center gap-1">
                    {hasLikes && (
                      <>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="currentColor" aria-hidden="true">
                          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2.1 0 3.8 1.2 5.6 3.2 1.8-2 3.5-3.2 5.6-3.2 3.7 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z" />
                        </svg>
                        {formatNumber(post.likeCount)}
                      </>
                    )}
                  </span>
                  {hasComments && <span>댓글 {formatNumber(post.commentCount)}</span>}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
