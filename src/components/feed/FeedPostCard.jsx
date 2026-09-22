import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { formatRelativeTime } from '../../utils/format.js'

/**
 * 피드 게시물 카드.
 *
 * 백엔드에 게시물/좋아요 API가 없어 좋아요는 화면 안에서만 반영된다.
 * (응모권 적립은 미션 API가 생긴 뒤에야 실제로 연결할 수 있다.)
 */
export default function FeedPostCard({ post, onLikeToggle, compact = false }) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes)

  function toggleLike() {
    const next = !liked
    setLiked(next)
    setLikes((count) => (next ? count + 1 : count - 1))
    onLikeToggle?.(next)
  }

  return (
    <article className={`bg-surface-container-lowest rounded-2xl shadow-card flex flex-col ${compact ? 'p-3' : 'p-4'}`}>
      <header className="flex items-center justify-between mb-3">
        <Link to={`/creators/${post.creatorId}`} className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-primary to-secondary shrink-0">
            <img className="w-full h-full rounded-full object-cover" src={post.avatar} alt="" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-title-md text-title-md text-on-surface font-bold truncate">
                {post.creatorHandle}
              </span>
              <MaterialIcon name="verified" filled className="text-primary text-[14px] shrink-0" />
            </div>
            <span className="font-label-xs text-label-xs text-outline">{formatRelativeTime(post.createdAt)}</span>
          </div>
        </Link>
        <button
          type="button"
          className="text-on-surface-variant p-1 rounded-full hover:bg-surface-container"
          aria-label="더보기"
        >
          <MaterialIcon name="more_horiz" className="text-[20px]" />
        </button>
      </header>

      <div className="rounded-xl overflow-hidden mb-3 bg-surface-container-high">
        <img
          className="w-full aspect-video h-auto object-cover"
          src={post.image}
          alt=""
        />
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={`flex items-center gap-1 active:scale-125 transition-transform ${
              liked ? 'text-error' : 'text-on-surface'
            }`}
          >
            <MaterialIcon name="favorite" filled={liked} className="text-[22px]" />
            <span className="font-label-sm text-label-sm font-semibold">{likes.toLocaleString()}</span>
          </button>
          <button type="button" className="flex items-center gap-1 text-on-surface-variant">
            <MaterialIcon name="mode_comment" className="text-[22px]" />
            <span className="font-label-sm text-label-sm font-semibold">{post.comments.toLocaleString()}</span>
          </button>
          <button type="button" className="text-on-surface-variant" aria-label="공유">
            <MaterialIcon name="send" className="text-[22px]" />
          </button>
        </div>
        <button type="button" className="text-on-surface-variant" aria-label="저장">
          <MaterialIcon name="bookmark_border" className="text-[22px]" />
        </button>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
        <span className="font-bold mr-1">{post.creatorHandle}</span>
        {post.caption}
      </p>
      {post.tags?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {post.tags.map((tag) => (
            <span key={tag} className="font-label-sm text-label-sm text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
