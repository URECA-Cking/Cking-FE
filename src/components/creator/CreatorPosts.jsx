import { useCallback, useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../ui/States.jsx'
import { ApiError, describeError } from '../../api/client.js'
import { getCreatorPost, getCreatorPosts } from '../../api/posts.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime } from '../../utils/format.js'

export default function CreatorPosts({ creatorId, creatorName, authenticated, following, isMine, followDisabled, onFollow, onLogin }) {
  const [extraState, setExtraState] = useState({ pages: [], loading: false, error: '' })
  const [detail, setDetail] = useState(null)
  const loadingMore = useRef(false)
  const detailSeq = useRef(0)
  // 로그인·팔로우 권한이 바뀌면 CreatorSpace의 key가 이 컴포넌트를 다시 마운트한다.
  const first = useAsync(
    () => getCreatorPosts(creatorId),
    [creatorId],
    { enabled: creatorId != null, fallbackMessage: '게시글을 불러오지 못했어요.' },
  )

  const page = first.data
  const extraPages = extraState.pages
  const lastPage = extraPages.at(-1) ?? page
  const seenPostIds = new Set()
  const posts = page ? [page, ...extraPages].flatMap((item) => item.items ?? []).filter((post) => {
    if (seenPostIds.has(post.postId)) return false
    seenPostIds.add(post.postId)
    return true
  }) : []

  function reloadFirst() {
    setExtraState({ pages: [], loading: false, error: '' })
    first.reload()
  }

  async function loadMore() {
    if (!lastPage?.hasNext || loadingMore.current) return
    loadingMore.current = true
    setExtraState({ pages: extraPages, loading: true, error: '' })
    try {
      const next = await getCreatorPosts(creatorId, { page: lastPage.page + 1 })
      setExtraState({ pages: [...extraPages, next], loading: false, error: '' })
    } catch (error) {
      setExtraState({ pages: extraPages, loading: false, error: describeError(error, '다음 게시글을 불러오지 못했어요.') })
    } finally {
      loadingMore.current = false
    }
  }

  async function openDetail(postId) {
    const seq = ++detailSeq.current
    setDetail({ postId, loading: true, post: null, error: '' })
    try {
      const post = await getCreatorPost(creatorId, postId)
      if (detailSeq.current === seq) setDetail({ postId, loading: false, post, error: '' })
    } catch (error) {
      if (detailSeq.current === seq) {
        const restricted = error instanceof ApiError && error.code === 'POST_FOLLOWERS_ONLY'
        setDetail({
          postId,
          loading: false,
          post: null,
          error: restricted ? '팔로워에게만 공개된 게시글이에요.' : describeError(error, '게시글을 불러오지 못했어요.'),
          restricted,
        })
      }
    }
  }

  const closeDetail = () => {
    detailSeq.current += 1
    setDetail(null)
  }
  const lockedAction = () => {
    if (!authenticated) onLogin()
    else if (!following && !isMine) onFollow()
    else reloadFirst()
  }
  const lockedLabel = !authenticated ? '로그인하고 팔로우하기' : following || isMine ? '다시 확인' : '팔로우하기'

  return (
    <div className="flex flex-col gap-space-md px-margin py-space-sm">
      {(first.loading || (!page && !first.error)) && <LoadingBlock label="게시글을 불러오는 중..." />}
      {!first.loading && first.error && <ErrorBlock message={first.error} onRetry={reloadFirst} />}
      {!first.loading && !first.error && page && posts.length === 0 && (
        <EmptyBlock icon="grid_view" message="아직 게시글이 없어요." />
      )}
      {!first.loading && !first.error && page && posts.map((post) => (
        <CreatorPostCard
          key={post.postId}
          post={post}
          creatorName={creatorName}
          onOpen={() => openDetail(post.postId)}
          onLockedAction={lockedAction}
          lockedLabel={lockedLabel}
          lockedDisabled={followDisabled}
        />
      ))}
      {!first.loading && !first.error && lastPage?.hasNext && (
        <button
          type="button"
          onClick={loadMore}
          disabled={extraState.loading}
          className="w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface disabled:opacity-60"
        >
          {extraState.loading ? '불러오는 중...' : '게시글 더 보기'}
        </button>
      )}
      {extraState.error && (
        <ErrorBlock message={extraState.error} onRetry={loadMore} />
      )}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={closeDetail}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="게시글 상세"
            className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface p-space-md md:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-title-lg text-title-lg text-on-surface">{creatorName}의 게시글</h3>
              <button type="button" onClick={closeDetail} aria-label="닫기" className="p-2 text-on-surface-variant">
                <MaterialIcon name="close" />
              </button>
            </div>
            {detail.loading && <LoadingBlock label="게시글을 불러오는 중..." />}
            {!detail.loading && detail.error && (
              <div>
                <ErrorBlock message={detail.error} onRetry={() => openDetail(detail.postId)} />
                {detail.restricted && (
                  <button type="button" onClick={lockedAction} disabled={followDisabled} className="w-full rounded-xl bg-primary py-3 text-on-primary disabled:opacity-60">
                    {lockedLabel}
                  </button>
                )}
              </div>
            )}
            {!detail.loading && detail.post && (
              <CreatorPostCard
                post={detail.post}
                creatorName={creatorName}
                onLockedAction={lockedAction}
                lockedLabel={lockedLabel}
                lockedDisabled={followDisabled}
                showOpen={false}
              />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function CreatorPostCard({ post, creatorName, onOpen, onLockedAction, lockedLabel, lockedDisabled, showOpen = true }) {
  const [restricted, setRestricted] = useState(false)
  const handleRestricted = useCallback(() => setRestricted(true), [])
  const locked = post.locked || restricted
  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-md shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-title-md text-title-md text-on-surface font-semibold">{creatorName}</span>
        <time className="font-label-xs text-label-xs text-outline" dateTime={post.createdAt}>
          {formatDateTime(post.createdAt)}
        </time>
      </div>
      {locked ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-low px-4 py-7 text-center">
          <MaterialIcon name="lock" className="text-[28px] text-primary" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">팔로워에게만 공개된 게시글이에요.</p>
          {post.imageCount > 0 && <p className="font-label-xs text-label-xs text-outline">이미지 {post.imageCount}장</p>}
          <button type="button" onClick={onLockedAction} disabled={lockedDisabled} className="rounded-xl bg-primary px-4 py-2 text-on-primary font-label-sm text-label-sm disabled:opacity-60">
            {lockedLabel}
          </button>
        </div>
      ) : (
        <>
          {post.content && <p className="whitespace-pre-wrap break-words font-body-md text-body-md text-on-surface">{post.content}</p>}
          <PostImages
            key={`${post.postId}:${post.updatedAt}:${(post.images ?? []).map((image) => image.url).join('|')}`}
            post={post}
            creatorName={creatorName}
            onRestricted={handleRestricted}
          />
          {showOpen && (
            <button type="button" onClick={onOpen} className="mt-3 font-label-sm text-label-sm text-primary">
              게시글 자세히 보기
            </button>
          )}
        </>
      )}
    </article>
  )
}

function PostImages({ post, creatorName, onRestricted }) {
  const [images, setImages] = useState(post.images ?? [])
  const [unavailable, setUnavailable] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const pending = useRef(false)
  const attemptedNull = useRef(false)
  const failedUrls = useRef(new Map())

  const refresh = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    setRefreshing(true)
    try {
      const latest = await getCreatorPost(post.creatorId, post.postId)
      if (latest.locked) {
        onRestricted()
        return
      }
      const latestImages = latest.images ?? []
      for (const image of latestImages) {
        if (images.find((previous) => previous.imageKey === image.imageKey)?.url !== image.url) {
          failedUrls.current.delete(image.imageKey)
        }
      }
      setImages(latestImages)
      setUnavailable(new Set(latestImages.filter((image) =>
        !image.url || (
          failedUrls.current.has(image.imageKey)
          && images.find((previous) => previous.imageKey === image.imageKey)?.url === image.url
        )
      ).map((image) => image.imageKey)))
    } catch (error) {
      if (error instanceof ApiError && error.code === 'POST_FOLLOWERS_ONLY') onRestricted()
      else setUnavailable(new Set(images.map((image) => image.imageKey)))
    } finally {
      pending.current = false
      setRefreshing(false)
    }
  }, [post.creatorId, post.postId, onRestricted, images])

  useEffect(() => {
    if (images.some((image) => !image.url) && !attemptedNull.current) {
      attemptedNull.current = true
      refresh()
    }
  }, [images, refresh])

  function handleError(image) {
    const attempts = failedUrls.current.get(image.imageKey) ?? 0
    if (attempts >= 1) {
      setUnavailable((current) => new Set([...current, image.imageKey]))
      return
    }
    failedUrls.current.set(image.imageKey, attempts + 1)
    refresh()
  }

  if (images.length === 0) return null
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory">
      {images.map((image, index) => (
        <div key={image.imageKey} className="min-w-[75%] snap-center rounded-xl bg-surface-container-low overflow-hidden">
          {image.url && !unavailable.has(image.imageKey) ? (
            <img
              src={image.url}
              alt={`${creatorName}의 게시글 이미지 ${index + 1}`}
              className="aspect-video w-full object-cover"
              onError={() => handleError(image)}
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-on-surface-variant">
              <MaterialIcon name="broken_image" className="text-[24px]" />
              <button type="button" onClick={() => { attemptedNull.current = true; failedUrls.current.delete(image.imageKey); refresh() }} disabled={refreshing} className="font-label-sm text-label-sm text-primary disabled:opacity-60">
                이미지 다시 불러오기
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
