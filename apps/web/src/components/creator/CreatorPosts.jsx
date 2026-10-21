import { useCallback, useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import ConfirmSheet from '../ui/ConfirmSheet.jsx'
import CreateFab from '../ui/CreateFab.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../ui/States.jsx'
import PostComments from './PostComments.jsx'
import PostEditorSheet from './PostEditorSheet.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import { POST_ERROR_MESSAGES, POST_LIKE_ERROR_MESSAGES, deletePost, getCreatorPost, getCreatorPosts, likePost, unlikePost } from '../../api/posts.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'
import { adjustCommentCount, applyCommentCount, reconcileCommentCounts } from '../../utils/postCommentCount.js'

// 웹 상세 모달의 사진 칸은 첫 사진의 비율(인스타처럼 4:5~1.91:1로 제한)에 맞추고, 오른쪽 정보 칸은 400px로 고정한다.
const MEDIA_RATIO_RANGE = [0.8, 1.91]
const INFO_PANEL_WIDTH = 400

/** 이벤트 시각(`event.timeStamp`)과 같은 기준의 현재 시각(ms). 시각이 넘어오지 않은 호출의 대체값이다. */
function monotonicNow() {
  return performance.now()
}

/** 게시물 이미지 비율과 유무에 맞춰 데스크톱 상세 창의 크기를 계산한다. */
function modalSize(ratio, hasMedia) {
  if (!hasMedia) return { '--modal-w': '560px', '--modal-h': 'min(92dvh, 720px)' }
  const mediaWidth = `min(800px, min(92dvh, 820px) * ${ratio}, 100vw - ${INFO_PANEL_WIDTH + 48}px)`
  return { '--modal-w': `calc(${mediaWidth} + ${INFO_PANEL_WIDTH}px)`, '--modal-h': `calc(${mediaWidth} / ${ratio})` }
}

// 저장·삭제 성공 응답을 재조회 전에 먼저 보여주기 위한 로컬 변경분.
const NO_LOCAL_CHANGES = { created: [], updated: {}, deleted: [] }

/** 크리에이터 게시물 목록과 상세, 작성·수정·삭제 및 좋아요 상태를 관리한다. */
export default function CreatorPosts({ creatorId, creatorName, profileImageUrl, authenticated, following, isMine, memberId, followDisabled, onFollow, onLogin, onMissionAwarded, initialPostId = null, onInitialPostOpened }) {
  const [extraState, setExtraState] = useState({ pages: [], loading: false, error: '' })
  const [detail, setDetail] = useState(null)
  const [mediaRatio, setMediaRatio] = useState(1)
  const showToast = useToast()
  // editor: null(닫힘) | { post: null }(작성) | { post }(수정)
  const [editor, setEditor] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  // 삭제 확인 시트를 연 게시물(없으면 null).
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [local, setLocal] = useState(NO_LOCAL_CHANGES)
  // 좋아요·취소 응답으로 받은 liked·likeCount. 목록과 상세에 같은 값을 보이려고 postId별로 덮어쓴다.
  const [likeOverrides, setLikeOverrides] = useState({})
  const [likingId, setLikingId] = useState(null)
  // 댓글을 등록·삭제한 직후 보여 줄 postId별 댓글 수. 서버 재조회 전에 목록 카드와 상세에 같은 값을 보인다.
  const [commentCountOverrides, setCommentCountOverridesState] = useState({})
  // 목록 재조회 응답 처리 시점의 최신 보정값을 읽으려고 상태와 같은 값을 ref에도 둔다.
  const commentCountOverridesRef = useRef({})
  const commentCountRevision = useRef(0)
  const setCommentCountOverrides = (next) => {
    const value = typeof next === 'function' ? next(commentCountOverridesRef.current) : next
    commentCountOverridesRef.current = value
    commentCountRevision.current += 1
    setCommentCountOverridesState(value)
  }
  // 열려 있는 상세의 postId. 목록을 새로 받아도 상세가 들고 있는 값과 어긋나지 않게 그 게시글의 덮어쓰기 값은 남긴다.
  const detailPostId = useRef(null)
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
  /** 서버 응답 위에 최신 좋아요 처리 결과를 적용한다. */
  const applyLike = (post) => applyCommentCount(likeOverrides[post.postId] ? { ...post, ...likeOverrides[post.postId] } : post, commentCountOverrides)
  const posts = [...local.created.filter((post) => !seenPostIds.has(post.postId)), ...loadedPosts]
    .filter((post) => !deletedIds.has(post.postId))
    .map((post) => applyLike(local.updated[post.postId] ?? post))

  // 로컬 변경분과 이어 붙인 페이지는 새 조회가 성공한 뒤에만 지운다. 실패하면 방금 저장·삭제한 결과를 그대로 둔다.
  // 새 목록 응답에는 서버의 최신 좋아요 값이 들어 있으므로 이전 덮어쓰기 값을 정리한다(열린 상세의 값은 유지).
  /** 목록 재조회 후 열린 상세 게시물의 좋아요 상태만 남긴다. */
  function clearListLikeOverrides(freshItems, requestedRevision) {
    const keep = detailPostId.current
    setLikeOverrides((current) => (keep != null && keep in current ? { [keep]: current[keep] } : {}))
    // 조회를 시작한 뒤 댓글을 변경하거나 댓글 목록에서 최신 수를 받았다면 오래된 목록 응답으로 덮지 않는다.
    if (commentCountRevision.current !== requestedRevision) return
    // 댓글 수는 새 목록에 그 게시글이 있으면 서버 값이 최신이라 보정값을 버리고, 열린 상세가 들고 있는 옛 수도 서버 값으로 맞춘다.
    const { overrides, detailCount } = reconcileCommentCounts(commentCountOverridesRef.current, keep, freshItems)
    setCommentCountOverrides(overrides)
    if (detailCount !== undefined) {
      setDetail((current) => (current?.post?.postId === keep ? { ...current, post: { ...current.post, commentCount: detailCount } } : current))
    }
  }

  /** 첫 페이지를 다시 읽고 목록·로컬 변경분을 서버 응답에 맞춘다. */
  async function reloadFirst() {
    const generation = ++listGeneration.current
    const requestedRevision = commentCountRevision.current
    loadingMore.current = false
    setExtraState((current) => ({ ...current, loading: false }))
    const fresh = await first.reload()
    if (fresh && listGeneration.current === generation) {
      setExtraState({ pages: [], loading: false, error: '' })
      setLocal(NO_LOCAL_CHANGES)
      clearListLikeOverrides(fresh.items, requestedRevision)
      setSync('synced')
    }
  }

  // 저장·삭제 성공 뒤 서버 순서로 보정한다. 실패해도 이미 반영한 목록은 그대로 두고 알림만 띄운다.
  /** 저장·삭제 후 화면을 유지하면서 게시물 목록을 동기화한다. */
  async function refreshQuietly() {
    const generation = ++listGeneration.current
    const requestedRevision = commentCountRevision.current
    loadingMore.current = false
    setExtraState((current) => ({ ...current, loading: false }))
    setSync('refreshing')
    try {
      const fresh = await getCreatorPosts(creatorId)
      if (listGeneration.current !== generation) return
      first.setData(fresh)
      setExtraState({ pages: [], loading: false, error: '' })
      setLocal(NO_LOCAL_CHANGES)
      clearListLikeOverrides(fresh.items, requestedRevision)
      setSync('synced')
    } catch {
      if (listGeneration.current === generation) {
        setSync('failed')
        showToast('목록을 새로 고치지 못했어요. 방금 변경한 내용은 반영되어 있어요.', { icon: 'error' })
      }
    }
  }

  /** 댓글을 등록(+1)하거나 삭제(-1)한 직후 그 게시글의 댓글 수를 목록과 상세에 먼저 반영한다. */
  function handleCommentCountChange(postId, delta) {
    const serverCount = [...posts, detail?.post].find((post) => post?.postId === postId)?.commentCount
    setCommentCountOverrides((current) => adjustCommentCount(current, postId, serverCount, delta))
  }

  /** 댓글 목록 재조회가 끝나면 서버의 전체 댓글 수를 목록 카드와 상세에 반영한다. */
  function handleCommentCountSync(postId, count) {
    setCommentCountOverrides((current) => ({ ...current, [postId]: count }))
  }

  /** 저장 결과를 목록에 먼저 반영하고 서버 목록을 재조회한다. */
  function handleSaved(saved, edited) {
    setLocal((current) => edited
      ? { ...current, updated: { ...current.updated, [saved.postId]: saved } }
      : { ...current, created: [saved, ...current.created] })
    refreshQuietly()
  }

  /** 삭제된 게시물을 목록에서 제외하고 서버 목록을 재조회한다. */
  function markDeleted(postId) {
    setLocal((current) => ({ ...current, deleted: [...current.deleted, postId] }))
    refreshQuietly()
  }

  // 이미지 주소는 10분만 유효하다. 썸네일이 실패하면 목록을 다시 받아 새 주소로 바꾼다(60초에 한 번만, 다시 실패해도 반복하지 않는다).
  const lastThumbRefresh = useRef(-Infinity)
  /** 썸네일 주소가 만료되면 일정 간격을 두고 목록을 다시 읽는다. */
  function handleThumbError(timeStamp) {
    // 시각이 넘어오지 않아도 NaN으로 제한이 풀리지 않게 현재 시각으로 대신한다.
    const now = Number.isFinite(timeStamp) ? timeStamp : monotonicNow()
    if (sync !== 'synced' || now - lastThumbRefresh.current < 60_000) return
    lastThumbRefresh.current = now
    refreshQuietly()
  }

  /** 중복 요청과 오래된 응답을 걸러 다음 게시물 페이지를 불러온다. */
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

  /** 게시물 상세를 열고 최신 상세 응답을 목록의 좋아요 상태에도 반영한다. */
  async function openDetail(postId) {
    const seq = ++detailSeq.current
    detailPostId.current = postId
    setMediaRatio(1)
    setDetail({ postId, loading: true, post: null, error: '' })
    try {
      const post = await getCreatorPost(creatorId, postId)
      if (detailSeq.current === seq) {
        // 방금 받은 상세가 서버의 최신 값이므로 목록에도 같은 값을 보이도록 덮어쓰기 값으로 맞춘다.
        if (typeof post.likeCount === 'number') {
          setLikeOverrides((current) => ({ ...current, [postId]: { liked: Boolean(post.liked), likeCount: post.likeCount } }))
        }
        // 상세 응답의 댓글 수도 서버 최신 값이다. 이전에 보정해 둔 값이 있어도 이 값으로 갈아끼운다.
        if (typeof post.commentCount === 'number') {
          setCommentCountOverrides((current) => ({ ...current, [postId]: post.commentCount }))
        }
        setDetail({ postId, loading: false, post, error: '' })
      }
    } catch (error) {
      if (detailSeq.current === seq) {
        const restricted = error instanceof ApiError && error.code === 'POST_FOLLOWERS_ONLY'
        setDetail({
          postId,
          loading: false,
          post: null,
          error: restricted ? '팬에게만 공개된 게시글이에요.' : describeError(error, '게시글을 불러오지 못했어요.'),
          restricted,
        })
      }
    }
  }

  // 홈 새 게시물 카드처럼 특정 게시물을 가리키며 들어오면 마운트 직후 그 상세를 연다. 한 번 열면 라우터 상태에서 지운다.
  useEffect(() => {
    if (initialPostId == null) return
    openDetail(initialPostId)
    onInitialPostOpened?.()
    // 진입 시 한 번만 연다. openDetail은 렌더마다 새로 만들어지지만 이 효과는 initialPostId 변화에만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostId])

  // 좋아요·취소는 서버 응답의 liked·likeCount를 그대로 반영한다(낙관적 갱신 없음). 처리 중에는 버튼을 막아 연타로 상태가 어긋나지 않게 한다.
  /** 서버의 좋아요·취소 응답으로 목록과 상세의 좋아요 상태를 갱신한다. */
  async function handleLike(post) {
    if (!authenticated) {
      onLogin()
      return
    }
    if (likingId != null) return
    setLikingId(post.postId)
    try {
      const result = post.liked ? await unlikePost(creatorId, post.postId) : await likePost(creatorId, post.postId)
      setLikeOverrides((current) => ({ ...current, [post.postId]: { liked: result.liked, likeCount: result.likeCount } }))
      if (result.missionAwarded) onMissionAwarded?.()
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null
      showToast(POST_LIKE_ERROR_MESSAGES[code] ?? describeError(error, '좋아요를 처리하지 못했어요.'), { icon: 'error' })
      if (code === 'POST_FOLLOWERS_ONLY') handlePostRestricted()
    } finally {
      setLikingId(null)
    }
  }

  /** 확인 시트에서 승인된 게시물을 삭제하고 상세와 목록을 갱신한다. */
  async function handleDelete(post) {
    if (deletingId != null) return
    setDeletingId(post.postId)
    try {
      await deletePost(post.postId)
      showToast('게시글을 삭제했어요.')
      closeDetail()
      markDeleted(post.postId)
    } catch (error) {
      const notFound = error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND'
      showToast(notFound ? POST_ERROR_MESSAGES.RESOURCE_NOT_FOUND : describeError(error, '게시글을 삭제하지 못했어요.'), { icon: 'error' })
      if (notFound) markDeleted(post.postId)
    } finally {
      // 성공·실패와 무관하게 시트를 닫는다. 실패는 토스트로 알리고, 다시 하려면 메뉴에서 삭제를 다시 누른다.
      setConfirmingDelete(null)
      setDeletingId(null)
    }
  }

  // 댓글 쪽에서 팔로워 전용 오류를 받으면(다른 곳에서 팔로우를 해제한 경우 등) 상세를 닫고 목록을 다시 받아 잠금 상태를 반영한다.
  /** 팔로우 권한이 사라진 게시물의 상세를 닫고 목록을 다시 읽는다. */
  const handlePostRestricted = () => {
    closeDetail()
    reloadFirst()
  }
  /** 진행 중인 상세 조회를 무효화하고 상세 화면을 닫는다. */
  const closeDetail = () => {
    detailSeq.current += 1
    detailPostId.current = null
    setDetail(null)
  }
  /** 잠긴 게시물의 로그인·팔로우·재조회 동작을 선택한다. */
  const lockedAction = () => {
    if (!authenticated) onLogin()
    else if (!following && !isMine) onFollow()
    else reloadFirst()
  }
  const lockedLabel = !authenticated ? '로그인하고 도킹하기' : following || isMine ? '다시 확인' : '도킹하기'

  // 수정은 바텀시트(z-40)로 열리므로 전체 화면 상세(z-60)를 먼저 닫는다.
  /** 상세를 닫고 선택한 게시물을 수정 화면에 전달한다. */
  const editFromDetail = (post) => {
    closeDetail()
    setEditor({ post })
  }

  return (
    <div className="flex flex-col pb-space-md pt-space-sm">
      {/* 목록이 보일 때만 쓰기를 열어, 저장한 글이 화면에 반영되지 못하는 상태를 만들지 않는다. */}
      {isMine && !first.loading && !first.error && page && (
        <CreateFab label="새 게시글" onClick={() => setEditor({ post: null })} />
      )}
      {(first.loading || (!page && !first.error)) && <LoadingBlock label="게시글을 불러오는 중..." />}
      {!first.loading && first.error && <ErrorBlock message={first.error} onRetry={reloadFirst} />}
      {!first.loading && !first.error && page && posts.length === 0 && (
        <EmptyBlock icon="grid_view" message="아직 게시글이 없어요." />
      )}
      {!first.loading && !first.error && page && posts.length > 0 && (
        <div className="grid grid-cols-3 gap-0.5 px-margin md:gap-1">
          {posts.map((post) => (
            <PostGridTile key={post.postId} post={post} onOpen={() => openDetail(post.postId)} onImageError={handleThumbError} />
          ))}
        </div>
      )}
      {!first.loading && !first.error && lastPage?.hasNext && (
        // 재시도도 refreshQuietly로 한다: 실패해도 first.error를 세우지 않아, 방금 저장·삭제한 결과가 계속 보인다.
        sync === 'failed' ? (
          <button
            type="button"
            onClick={refreshQuietly}
            className="mx-margin mt-space-md rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface"
          >
            목록을 새로 고쳐야 이어서 볼 수 있어요
          </button>
        ) : (
          <button
            type="button"
            onClick={loadMore}
            disabled={extraState.loading || sync === 'refreshing'}
            className="mx-margin mt-space-md rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface disabled:opacity-60"
          >
            {extraState.loading || sync === 'refreshing' ? '불러오는 중...' : '게시글 더 보기'}
          </button>
        )
      )}
      {extraState.error && (
        <div className="px-margin">
          <ErrorBlock message={extraState.error} onRetry={loadMore} />
        </div>
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
        <div role="dialog" aria-modal="true" aria-label="게시글 상세" className="fixed inset-0 z-[60] flex justify-center bg-surface md:items-center md:bg-black/60 md:p-6" onClick={closeDetail}>
          <button type="button" onClick={closeDetail} aria-label="닫기" className="absolute right-4 top-4 hidden h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/15 md:flex">
            <MaterialIcon name="close" className="text-[26px]" />
          </button>
          <div className="flex h-full w-full max-w-xl flex-col md:h-[var(--modal-h)] md:w-[var(--modal-w)] md:max-w-none md:overflow-hidden md:rounded-xl md:bg-surface" style={modalSize(mediaRatio, Boolean(detail.post && !detail.post.locked && detail.post.imageCount > 0))} onClick={(event) => event.stopPropagation()}>
            <header className="flex h-14 shrink-0 items-center gap-1 border-b border-surface-container-high bg-surface px-2 pt-safe md:hidden">
              <button type="button" onClick={closeDetail} aria-label="닫기" className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-container">
                <MaterialIcon name="arrow_back" className="text-[22px]" />
              </button>
              <h3 className="font-title-md text-title-md font-semibold text-on-surface">게시물</h3>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto pb-safe md:grid md:grid-cols-[minmax(0,1fr)_400px] md:overflow-hidden md:pb-0">
              {detail.loading && <div className="md:col-span-2"><LoadingBlock label="게시글을 불러오는 중..." /></div>}
              {!detail.loading && detail.error && (
                <div className="px-margin py-space-md md:col-span-2">
                  <ErrorBlock message={detail.error} onRetry={() => openDetail(detail.postId)} />
                  {detail.restricted && (
                    <button type="button" onClick={lockedAction} disabled={followDisabled} className="w-full rounded-xl bg-primary py-3 text-on-primary disabled:opacity-60">
                      {lockedLabel}
                    </button>
                  )}
                </div>
              )}
              {!detail.loading && detail.post && (
                <PostDetail
                  post={applyLike(detail.post)}
                  onLike={() => handleLike(applyLike(detail.post))}
                  liking={likingId === detail.post.postId}
                  creatorName={creatorName}
                  profileImageUrl={profileImageUrl}
                  onLockedAction={lockedAction}
                  lockedLabel={lockedLabel}
                  lockedDisabled={followDisabled}
                  isMine={isMine}
                  onEdit={() => editFromDetail(detail.post)}
                  onDelete={() => setConfirmingDelete(detail.post)}
                  deleting={deletingId === detail.post.postId}
                  onMediaRatio={setMediaRatio}
                >
                  {!detail.post.locked && (
                    <PostComments
                      key={detail.post.postId}
                      creatorId={creatorId}
                      postId={detail.post.postId}
                      authenticated={authenticated}
                      following={following}
                      isMine={isMine}
                      memberId={memberId}
                      followDisabled={followDisabled}
                      onFollow={onFollow}
                      onLogin={onLogin}
                      onPostRestricted={handlePostRestricted}
                      onCommentCountChange={(delta) => handleCommentCountChange(detail.post.postId, delta)}
                      onCommentCountSync={(count) => handleCommentCountSync(detail.post.postId, count)}
                    />
                  )}
                </PostDetail>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmSheet
        open={confirmingDelete !== null}
        title="게시글을 삭제할까요?"
        message="삭제하면 이미지와 댓글도 함께 사라지고 되돌릴 수 없어요."
        busy={deletingId !== null}
        onConfirm={() => handleDelete(confirmingDelete)}
        onClose={() => setConfirmingDelete(null)}
      />
    </div>
  )
}

/** 그리드 한 칸: 첫 이미지를 정사각으로. 잠금·텍스트 전용·이미지 실패는 아이콘/본문 타일로 대신한다. */
function PostGridTile({ post, onOpen, onImageError }) {
  // 실패한 "주소"를 기억해서, 목록을 다시 받아 새 주소가 오면 이미지를 다시 보여준다.
  const [failedUrl, setFailedUrl] = useState(null)
  const thumb = post.images?.[0]?.url
  const showImage = !post.locked && thumb && failedUrl !== thumb
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={post.locked ? '팬 전용 게시글' : `게시글 ${post.content?.slice(0, 20) ?? ''}`.trim()}
      className="group relative block aspect-square w-full overflow-hidden bg-surface-container active:opacity-80"
    >
      {showImage ? (
        <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={(event) => { setFailedUrl(thumb); onImageError?.(event.timeStamp) }} />
      ) : post.locked ? (
        <span className="flex h-full w-full items-center justify-center bg-surface-container-high text-on-surface-variant">
          <MaterialIcon name="lock" className="text-[28px]" />
        </span>
      ) : post.content && !(post.imageCount > 0) ? (
        <span className="flex h-full w-full items-center justify-center bg-surface-container-low p-3 text-center md:p-5">
          <span className="line-clamp-6 break-words font-body-sm text-body-sm text-on-surface md:text-body-md">{post.content}</span>
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-on-surface-variant">
          <MaterialIcon name="image" className="text-[28px]" />
        </span>
      )}
      {post.imageCount > 1 && (
        <MaterialIcon name="filter_none" className="absolute right-1.5 top-1.5 text-[18px] text-white drop-shadow" />
      )}
      {!post.locked && (typeof post.likeCount === 'number' || typeof post.commentCount === 'number') && (
        <span className="absolute inset-0 hidden items-center justify-center gap-6 bg-black/40 font-label-md text-label-md font-semibold text-white md:group-hover:flex">
          {typeof post.likeCount === 'number' && (
            <span className="flex items-center gap-1.5"><MaterialIcon name="favorite" filled className="text-[20px]" />{formatNumber(post.likeCount)}</span>
          )}
          {typeof post.commentCount === 'number' && (
            <span className="flex items-center gap-1.5"><MaterialIcon name="chat_bubble" filled className="text-[20px]" />{formatNumber(post.commentCount)}</span>
          )}
        </span>
      )}
      {!post.locked && post.visibility === 'FOLLOWERS' && (
        <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
          <MaterialIcon name="lock" className="text-[13px]" />
        </span>
      )}
    </button>
  )
}

/** 게시물 본문만 보여주고 길면 접는다. */
function Caption({ content }) {
  const [expanded, setExpanded] = useState(false)
  const long = content.length > 90 || content.split('\n').length > 3
  return (
    <div className="font-body-md text-body-md text-on-surface">
      <p className={`whitespace-pre-wrap break-words ${expanded || !long ? '' : 'line-clamp-3'}`}>
        {content}
      </p>
      {long && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">
          더보기
        </button>
      )}
    </div>
  )
}

const formatCompactPostTime = formatDateTime

/** 작성자 이름 옆에 작성 시각을 보여주고, 내 글이면 공개 범위와 수정·삭제 메뉴를 제공한다. */
function AuthorRow({ creatorName, profileImageUrl, createdAt, visibility, isMine, onEdit, onDelete, deleting }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="flex items-center gap-2.5 px-margin py-2.5">
      <ProfilePhoto src={profileImageUrl} className="h-8 w-8 shrink-0" iconClassName="text-[18px]" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-label-md text-label-md font-semibold text-on-surface">{creatorName}</span>
          <time dateTime={createdAt} className="hidden shrink-0 font-label-xs text-label-xs text-outline md:inline">{formatDateTime(createdAt)}</time>
        </div>
        <div className="flex items-center gap-1 font-label-xs text-label-xs text-outline">
          <time dateTime={createdAt} className="md:hidden">{formatCompactPostTime(createdAt)}</time>
          {isMine && (
            <>
              <span aria-hidden="true" className="md:hidden">·</span>
            <MaterialIcon name={visibility === 'FOLLOWERS' ? 'lock' : 'public'} className="text-[14px]" />
            {visibility === 'FOLLOWERS' ? '팬 공개' : '전체 공개'}
            </>
          )}
        </div>
      </div>
      {isMine && onEdit && (
        <div className="relative">
          <button
            type="button"
            aria-label="게시글 메뉴"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            disabled={deleting}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container disabled:opacity-50"
          >
            <MaterialIcon name="more_horiz" className="text-[22px]" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-10 w-28 overflow-hidden rounded-xl bg-surface-container-lowest shadow-card">
              <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className="block w-full px-3 py-2.5 text-left font-label-md text-label-md text-on-surface hover:bg-surface-container">
                수정
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onDelete() }} className="block w-full px-3 py-2.5 text-left font-label-md text-label-md text-error hover:bg-surface-container">
                삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 게시물 상세를 좁은 화면에서는 작성자 → 이미지 → 본문 → 좋아요 → 댓글 순으로 쌓고,
 * 넓은 화면(md 이상)에서는 왼쪽 이미지, 오른쪽 작성자·본문·좋아요·댓글(children)의 2단으로 나눈다.
 */
function PostDetail({ post, onLike, liking, creatorName, profileImageUrl, onLockedAction, lockedLabel, lockedDisabled, isMine, onEdit, onDelete, deleting, onMediaRatio, children }) {
  const [restricted, setRestricted] = useState(false)
  /** 이미지 재조회에서 접근 제한을 확인하면 본문과 댓글을 숨긴다. */
  const handleRestricted = useCallback(() => setRestricted(true), [])
  const commentsRef = useRef(null)
  // 댓글 영역은 기본으로 접는다. 펼친 게시글의 id를 기억해, 다른 게시글로 넘어가면 다시 접힌 상태가 된다.
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null)
  const commentsOpen = openCommentsPostId === post.postId
  /** 댓글 버튼을 누르면 하트 아래에서 댓글 영역을 펼치거나 접는다. 펼칠 때는 배치가 끝난 뒤 그 위치로 스크롤한다. */
  const toggleComments = () => {
    if (commentsOpen) {
      setOpenCommentsPostId(null)
      return
    }
    setOpenCommentsPostId(post.postId)
    requestAnimationFrame(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const locked = post.locked || restricted
  const hasMedia = !locked && post.imageCount > 0
  const hasLikes = typeof post.likeCount === 'number'
  const liked = Boolean(post.liked)
  const author = (
    <AuthorRow creatorName={creatorName} profileImageUrl={profileImageUrl} createdAt={post.createdAt} visibility={post.visibility} isMine={isMine} onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
  )
  return (
    <>
      <div className="md:hidden">{author}</div>
      {hasMedia && (
        <div className="md:flex md:min-h-0 md:overflow-hidden md:bg-black">
          <div className="w-full md:h-full">
            <PostImages
              key={`${post.postId}:${post.updatedAt}:${(post.images ?? []).map((image) => image.url).join('|')}`}
              post={post}
              creatorName={creatorName}
              onRestricted={handleRestricted}
              onRatio={onMediaRatio}
            />
          </div>
        </div>
      )}
      <div className={`md:flex md:min-h-0 md:flex-col ${hasMedia ? 'md:border-l md:border-surface-container-high' : 'md:col-span-2'}`}>
      <div className="hidden shrink-0 border-b border-surface-container-high md:block">{author}</div>
      <article className="pb-space-sm md:min-h-0 md:flex-1 md:overflow-y-auto md:pt-2">
        {locked ? (
          <div className="mx-margin flex flex-col items-center gap-3 rounded-xl bg-surface-container-low px-4 py-7 text-center">
            <MaterialIcon name="lock" className="text-[28px] text-primary" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">팬에게만 공개된 게시글이에요.</p>
            {post.imageCount > 0 && <p className="font-label-xs text-label-xs text-outline">이미지 {post.imageCount}장</p>}
            <button type="button" onClick={onLockedAction} disabled={lockedDisabled} className="rounded-xl bg-primary px-4 py-2 text-on-primary font-label-sm text-label-sm disabled:opacity-60">
              {lockedLabel}
            </button>
          </div>
        ) : (
          <>
            {post.content && (
              <div className="px-margin pt-2.5">
                <Caption content={post.content} />
              </div>
            )}
            <div className="flex items-center gap-4 px-margin pt-2.5">
                {hasLikes && (
                  <button
                    type="button"
                    aria-pressed={liked}
                    aria-label={liked ? '좋아요 취소' : '좋아요'}
                    onClick={onLike}
                    disabled={liking}
                    className={`flex items-center gap-1.5 font-label-md text-label-md active:scale-95 disabled:opacity-60 ${liked ? 'text-error' : 'text-on-surface'}`}
                  >
                    <MaterialIcon name="favorite" filled={liked} className="text-[24px]" />
                    {formatNumber(post.likeCount)}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={commentsOpen ? '댓글 접기' : '댓글 열기'}
                  aria-expanded={commentsOpen}
                  onClick={toggleComments}
                  className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface active:scale-95"
                >
                  <MaterialIcon name="chat_bubble" className="text-[22px]" />
                  {typeof post.commentCount === 'number' && formatNumber(post.commentCount)}
                </button>
              </div>
          </>
        )}
        {!locked && (
          // 접어도 마운트를 유지해 쓰던 댓글 입력이 사라지지 않게 한다.
          <div ref={commentsRef} hidden={!commentsOpen} className="px-margin pb-space-sm">{children}</div>
        )}
      </article>
      </div>
    </>
  )
}

/** 게시물 이미지를 캐러셀로 보여주고 만료된 이미지 주소를 복구한다. */
function PostImages({ post, creatorName, onRestricted, onRatio }) {
  const [images, setImages] = useState(post.images ?? [])
  const [unavailable, setUnavailable] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  // 이미지별 다시 불러오기 횟수. 주소가 같아도 <img>를 새로 만들어 다시 요청하게 하는 key에 쓴다.
  const [reloads, setReloads] = useState({})
  const [active, setActive] = useState(0)
  // 첫 사진의 비율(4:5~1.91:1)을 칸 비율로 쓴다. 폰에서는 이 비율대로, 웹 모달에서는 모달이 같은 비율로 커진다.
  const [ratio, setRatio] = useState(1)
  const scroller = useRef(null)
  const pending = useRef(false)
  const attemptedNull = useRef(false)
  const failedAttempts = useRef(new Map())

  /** 게시물을 다시 조회해 이미지 주소와 접근 권한을 갱신한다. */
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
      setUnavailable(new Set(latestImages.filter((image) => !image.url).map((image) => image.imageKey)))
      // 로드에 실패했던 이미지는 주소가 그대로여도 한 번 더 불러온다. 네트워크 순간 끊김이나 iOS의 화면 밖 요청 중단 같은
      // 일시 실패를 바로 "표시 불가"로 굳히지 않으려는 것이다. 다시 실패하면 handleError가 그때 확정한다.
      setReloads((current) => {
        const next = { ...current }
        failedAttempts.current.forEach((_, imageKey) => { next[imageKey] = (next[imageKey] ?? 0) + 1 })
        return next
      })
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

  /** 이미지 로딩 실패 시 주소를 한 번 갱신하고 재실패 시 대체 화면을 표시한다. */
  function handleError(image) {
    const attempts = failedAttempts.current.get(image.imageKey) ?? 0
    if (attempts >= 1) {
      setUnavailable((current) => new Set([...current, image.imageKey]))
      return
    }
    failedAttempts.current.set(image.imageKey, attempts + 1)
    refresh()
  }

  /** 지정한 이미지로 캐러셀을 이동한다. */
  const goTo = useCallback((index) => {
    const node = scroller.current
    if (!node) return
    const next = Math.min(images.length - 1, Math.max(0, index))
    node.scrollTo({ left: next * node.clientWidth, behavior: 'smooth' })
  }, [images.length])

  // 방향키로도 넘긴다. 댓글 입력 중에는 커서 이동에 쓰이므로 입력 요소에서는 무시한다.
  useEffect(() => {
    if (images.length < 2) return undefined
    /** 입력 요소 밖에서 누른 좌우 방향키로 이미지를 넘긴다. */
    function onKeyDown(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      goTo(active + (event.key === 'ArrowRight' ? 1 : -1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [images.length, active, goTo])

  if (images.length === 0) return null
  return (
    <div className="relative md:h-full" style={{ '--media-ratio': ratio }}>
      <div
        ref={scroller}
        className="flex aspect-[var(--media-ratio)] overflow-x-auto overscroll-x-contain snap-x snap-mandatory no-scrollbar md:aspect-auto md:h-full"
        onScroll={(event) => setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
      >
      {images.map((image, index) => (
        <div key={image.imageKey} className="h-full min-w-full snap-center bg-surface-container-low overflow-hidden">
          {image.url && !unavailable.has(image.imageKey) ? (
            <img
              key={reloads[image.imageKey] ?? 0}
              src={image.url}
              alt={`${creatorName}의 게시글 이미지 ${index + 1}`}
              className="h-full w-full object-cover"
              onError={() => handleError(image)}
              onLoad={index === 0 ? (event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget
                if (!naturalWidth || !naturalHeight) return
                const next = Math.min(MEDIA_RATIO_RANGE[1], Math.max(MEDIA_RATIO_RANGE[0], naturalWidth / naturalHeight))
                setRatio(next)
                onRatio?.(next)
              } : undefined}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-on-surface-variant">
              <MaterialIcon name="broken_image" className="text-[24px]" />
              <button type="button" onClick={() => { attemptedNull.current = true; failedAttempts.current.delete(image.imageKey); refresh() }} disabled={refreshing} className="font-label-sm text-label-sm text-primary disabled:opacity-60">
                이미지 다시 불러오기
              </button>
            </div>
          )}
        </div>
      ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 font-label-xs text-label-xs font-semibold text-white" aria-hidden="true">
            {active + 1}/{images.length}
          </span>
          {active > 0 && (
            <button type="button" aria-label="이전 사진" onClick={() => goTo(active - 1)} className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-md hover:bg-white md:flex">
              <MaterialIcon name="chevron_left" className="text-[22px]" />
            </button>
          )}
          {active < images.length - 1 && (
            <button type="button" aria-label="다음 사진" onClick={() => goTo(active + 1)} className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-md hover:bg-white md:flex">
              <MaterialIcon name="chevron_right" className="text-[22px]" />
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1 drop-shadow" aria-hidden="true">
            {images.map((image, index) => (
              <span key={image.imageKey} className={`h-1.5 w-1.5 rounded-full transition-colors ${index === active ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
