import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'

export default function FeedPostCard({ post, onLikeToggle }) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes)

  function toggleLike() {
    setLiked((prev) => {
      const next = !prev
      setLikes((count) => (next ? count + 1 : count - 1))
      onLikeToggle?.(next)
      return next
    })
  }

  return (
    <article className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-primary to-secondary">
            <img className="w-full h-full rounded-full object-cover" src={post.image} alt="" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-title-md text-title-md text-on-surface font-bold">{post.creatorHandle}</span>
              <MaterialIcon name="verified" filled className="text-primary text-[14px]" />
            </div>
            <span className="font-label-xs text-label-xs text-outline">{post.timeAgo}</span>
          </div>
        </div>
        <button type="button" className="text-on-surface-variant p-1 rounded-full hover:bg-surface-container" aria-label="더보기">
          <MaterialIcon name="more_horiz" className="text-[20px]" />
        </button>
      </header>

      <div className="rounded-xl overflow-hidden mb-3 bg-surface-container-high">
        <img className="w-full h-56 object-cover" src={post.image} alt="" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1 active:scale-125 transition-transform ${liked ? 'text-error' : 'text-on-surface'}`}
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
