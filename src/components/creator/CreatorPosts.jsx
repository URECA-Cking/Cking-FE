import { useCallback, useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import PostEditorSheet from './PostEditorSheet.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import { POST_ERROR_MESSAGES, deletePost, getCreatorPost, getCreatorPosts } from '../../api/posts.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime } from '../../utils/format.js'

// 저장·삭제 성공 응답을 재조회 전에 먼저 보여주기 위한 로컬 변경분.
const NO_LOCAL_CHANGES = { created: [], updated: {}, deleted: [] }

export default function CreatorPosts({ creatorId, creatorName, authenticated, following, isMine, followDisabled, onFollow, onLogin }) {
  const [extraState, setExtraState] = useState({ pages: [], loading: false, error: '' })
  const [detail, setDetail] = useState(null)
  const showToast = useToast()
  // editor: null(닫힘) | { post: null }(작성) | { post }(수정)
  const [editor, setEditor] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [local, setLocal] = useState(NO_LOCAL_CHANGES)
  // 저장·삭제 뒤 서버 목록과 맞추는 상태: 'synced' | 'refreshing' | 'failed'.
  // 삭제로 서버의 페이지 경계가 당겨지므로 맞춰지기 전에는 기존 페이지 번호로 '더 보기'를 하지 않는다.
  const [sync, setSync] = useState('synced')
  const loadingMore = useRef(false)
  // 첫 페이지를 다시 읽을 때마다 올려서, 그 전에 시작한 '더 보기' 응답이 늦게 와도 버린다.
  const listGeneration = useRef(0)
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
  const loadedPosts = page ? [page, ...extraPages].flatMap((item) => item.items ?? []).filter((post) => {
    if (seenPostIds.has(post.postId)) return false
    seenPostIds.add(post.postId)
    return true
  }) : []
  const deletedIds = new Set(local.deleted)
  const posts = [...local.created.filter((post) => !seenPostIds.has(post.postId)), ...loadedPosts]
    .filter((post) => !deletedIds.has(post.postId))
    .map((post) => local.updated[post.postId] ?? post)

  // 로컬 변경분과 이어 붙인 페이지는 새 조회가 성공한 뒤에만 지운다. 실패하면 방금 저장·삭제한 결과를 그대로 둔다.
  async function reloadFirst() {
    const generation = ++listGeneration.current
    loadingMore.current = false
    setExtraState((current) => ({ ...current, loading: false }))
    const fresh = await first.reload()
    if (fresh && listGeneration.current === generation) {
      setExtraState({ pages: [], loading: false, error: '' })
      setLocal(NO_LOCAL_CHANGES)
      setSync('synced')
    }
  }

  // 저장·삭제 성공 뒤 서버 순서로 보정한다. 실패해도 이미 반영한 목록은 그대로 두고 알림만 띄운다.
  async function refreshQuietly() {
    const generation = ++listGeneration.current
    loadingMore.current = false
    setExtraState((current) => ({ ...current, loading: false }))
    setSync('refreshing')
    try {
      const fresh = await getCreatorPosts(creatorId)
      if (listGeneration.current !== generation) return
      first.setData(fresh)
      setExtraState({ pages: [], loading: false, error: '' })
      setLocal(NO_LOCAL_CHANGES)
      setSync('synced')
    } catch {
      if (listGeneration.current === generation) {
        setSync('failed')
        showToast('목록을 새로 고치지 못했어요. 방금 변경한 내용은 반영되어 있어요.', { icon: 'error' })
      }
    }
  }

  function handleSaved(saved, edited) {
    setLocal((current) => edited
      ? { ...current, updated: { ...current.updated, [saved.postId]: saved } }
      : { ...current, created: [saved, ...current.created] })
    refreshQuietly()
  }

  function markDeleted(postId) {
    setLocal((current) => ({ ...current, deleted: [...current.deleted, postId] }))
    refreshQuietly()
  }

  async function loadMore() {
    if (!lastPage?.hasNext || loadingMore.current || sync !== 'synced') return
    loadingMore.current = true
    const generation = listGeneration.current
    setExtraState({ pages: extraPages, loading: true, error: '' })
    try {
      const next = await getCreatorPosts(creatorId, { page: lastPage.page + 1 })
      if (listGeneration.current !== generation) return
      setExtraState({ pages: [...extraPages, next], loading: false, error: '' })
    } catch (error) {
      if (listGeneration.current !== generation) return
      setExtraState({ pages: extraPages, loading: false, error: describeError(error, '다음 게시글을 불러오지 못했어요.') })
    } finally {
      if (listGeneration.current === generation) loadingMore.current = false
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

  async function handleDelete(post) {
    if (deletingId != null) return
    if (!window.confirm('이 게시글을 삭제할까요? 삭제하면 이미지와 댓글도 함께 사라지고 되돌릴 수 없어요.')) return
    setDeletingId(post.postId)
    try {
      await deletePost(post.postId)
      showToast('게시글을 삭제했어요.')
      markDeleted(post.postId)
    } catch (error) {
      const notFound = error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND'
      showToast(notFound ? POST_ERROR_MESSAGES.RESOURCE_NOT_FOUND : describeError(error, '게시글을 삭제하지 못했어요.'), { icon: 'error' })
      if (notFound) markDeleted(post.postId)
    } finally {
      setDeletingId(null)
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
      {/* 목록이 보일 때만 쓰기를 열어, 저장한 글이 화면에 반영되지 못하는 상태를 만들지 않는다. */}
      {isMine && !first.loading && !first.error && page && (
        <button
          type="button"
          onClick={() => setEditor({ post: null })}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-label-md text-label-md font-semibold text-on-primary active:scale-[0.98]"
        >
          <MaterialIcon name="edit" className="text-[18px]" />
          게시글 쓰기
        </button>
      )}
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
          isMine={isMine}
          onEdit={() => setEditor({ post })}
          onDelete={() => handleDelete(post)}
          deleting={deletingId === post.postId}
        />
      ))}
      {!first.loading && !first.error && lastPage?.hasNext && (
        // 재시도도 refreshQuietly로 한다: 실패해도 first.error를 세우지 않아, 방금 저장·삭제한 결과가 계속 보인다.
        sync === 'failed' ? (
          <button
            type="button"
            onClick={refreshQuietly}
            className="w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface"
          >
            목록을 새로 고쳐야 이어서 볼 수 있어요
          </button>
        ) : (
          <button
            type="button"
            onClick={loadMore}
            disabled={extraState.loading || sync === 'refreshing'}
            className="w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface disabled:opacity-60"
          >
            {extraState.loading || sync === 'refreshing' ? '불러오는 중...' : '게시글 더 보기'}
          </button>
        )
      )}
      {extraState.error && (
        <ErrorBlock message={extraState.error} onRetry={loadMore} />
      )}
      {isMine && (
        <PostEditorSheet
          open={editor !== null}
          onClose={() => setEditor(null)}
          post={editor?.post ?? null}
          onSaved={(saved) => handleSaved(saved, editor?.post != null)}
        />
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

function CreatorPostCard({ post, creatorName, onOpen, onLockedAction, lockedLabel, lockedDisabled, showOpen = true, isMine = false, onEdit, onDelete, deleting = false }) {
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
      {isMine && onEdit && (
        <div className="mb-3 flex items-center gap-2">
          <StatusPill
            label={post.visibility === 'FOLLOWERS' ? '팔로워 공개' : '전체 공개'}
            icon={post.visibility === 'FOLLOWERS' ? 'lock' : 'public'}
          />
          <button type="button" onClick={onEdit} disabled={deleting} className="ml-auto font-label-sm text-label-sm text-primary disabled:opacity-50">
            수정
          </button>
          <button type="button" onClick={onDelete} disabled={deleting} className="font-label-sm text-label-sm text-error disabled:opacity-50">
            {deleting ? '삭제하는 중...' : '삭제'}
          </button>
        </div>
      )}
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
  const failedAttempts = useRef(new Map())

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
      setImages(latestImages)
      setUnavailable(new Set(latestImages.filter((image) =>
        !image.url || (
          failedAttempts.current.has(image.imageKey)
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
    const attempts = failedAttempts.current.get(image.imageKey) ?? 0
    if (attempts >= 1) {
      setUnavailable((current) => new Set([...current, image.imageKey]))
      return
    }
    failedAttempts.current.set(image.imageKey, attempts + 1)
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
              <button type="button" onClick={() => { attemptedNull.current = true; failedAttempts.current.delete(image.imageKey); refresh() }} disabled={refreshing} className="font-label-sm text-label-sm text-primary disabled:opacity-60">
                이미지 다시 불러오기
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
