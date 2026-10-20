import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { toSafeImageUrl } from '../../utils/safeUrl.js'
import { spacePath } from '../../api/creatorSpace.js'
import SectionTitle from './SectionTitle.jsx'
import { formatNumber, formatRelativeTime } from '../../utils/format.js'

// 한 번에 보여주는 카드 수. 가로로 넘겨 보므로 세로 공간은 늘지 않는다.
const FEED_LIMIT = 8

/** 본문을 제목(첫 줄)과 부제(나머지)로 나눈다. 본문이 없는 글은 제목이 비고, 사진도 없는 글(잠긴 글 등)만 안내 문구가 제목이 된다. */
function splitContent(post, hasImage) {
  const lines = (post.content ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return { title: hasImage ? '' : '새 글을 올렸어요', subtitle: '' }
  return { title: lines[0], subtitle: lines.slice(1).join(' ') }
}

/**
 * 팔로우한 크리에이터의 게시물을 최신순 가로 카드로. 카드를 누르면 그 크리에이터 스페이스의 게시물 탭으로 간다.
 * 사진이 있는 글은 본문 오른쪽에 작은 썸네일을, 사진만 있는 글은 본문 영역 전체를 사진으로 채운다.
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
      {/* 카드 안 sr-only 라벨(absolute)이 이 컨테이너 안에 갇히도록 relative를 둔다. 없으면 문서 폭이 늘어 페이지가 가로로 스크롤된다. */}
      <div className="relative flex gap-3 overflow-x-auto overscroll-x-contain px-margin no-scrollbar">
        {cards.map((post) => {
          const creator = creatorById.get(post.creatorId)
          const thumb = toSafeImageUrl(post.images?.[0]?.url)
          const { title, subtitle } = splitContent(post, Boolean(thumb))
          const imageOnly = Boolean(thumb) && !title
          const hasLikes = typeof post.likeCount === 'number'
          const hasComments = typeof post.commentCount === 'number'
          return (
            <Link
              key={post.postId}
              to={spacePath(creator.handle)}
              state={{ tab: 'posts' }}
              className="flex min-h-[7.5rem] w-52 flex-shrink-0 flex-col rounded-2xl border border-on-surface/10 bg-surface-container p-3.5 active:opacity-80 transition-opacity"
            >
              <span className="mb-2.5 flex items-center gap-1.5 min-w-0">
                <span className="block h-5 w-5 flex-shrink-0 rounded-full overflow-hidden">
                  <ProfilePhoto src={creator.avatar} className="h-full w-full" iconClassName="text-[14px]" loading="lazy" decoding="async" />
                </span>
                <span className="min-w-0 font-label-sm text-label-sm text-outline font-normal truncate">
                  <span className="text-on-surface font-semibold">{creator.name}</span> · {formatRelativeTime(post.createdAt)}
                </span>
              </span>
              {imageOnly ? (
                <span className="relative block min-h-16 flex-1 overflow-hidden rounded-lg bg-surface-container-high">
                  <img className="absolute inset-0 h-full w-full object-cover" src={thumb} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <span className="flex min-h-0 flex-1 items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className={`font-label-md text-label-md font-extrabold text-on-surface break-keep ${subtitle || thumb ? 'line-clamp-2' : 'line-clamp-3'}`}>{title}</span>
                    {subtitle && <span className="mt-1 font-label-sm text-label-sm text-on-surface-variant font-normal line-clamp-1">{subtitle}</span>}
                  </span>
                  {thumb && (
                    <img className="h-14 w-14 flex-shrink-0 rounded-lg object-cover bg-surface-container-high" src={thumb} alt="" loading="lazy" decoding="async" />
                  )}
                </span>
              )}
              {(hasLikes || hasComments) && (
                <span className="mt-2 flex items-center justify-between border-t border-on-surface/5 pt-2 font-label-sm text-[11px] text-outline font-normal">
                  {hasLikes && (
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="currentColor" aria-hidden="true">
                        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2.1 0 3.8 1.2 5.6 3.2 1.8-2 3.5-3.2 5.6-3.2 3.7 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z" />
                      </svg>
                      <span aria-hidden="true">{formatNumber(post.likeCount)}</span>
                      <span className="sr-only">좋아요 {formatNumber(post.likeCount)}개</span>
                    </span>
                  )}
                  {hasComments && (
                    <span className="ml-auto">
                      <span aria-hidden="true">댓글 {formatNumber(post.commentCount)}</span>
                      <span className="sr-only">댓글 {formatNumber(post.commentCount)}개</span>
                    </span>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
