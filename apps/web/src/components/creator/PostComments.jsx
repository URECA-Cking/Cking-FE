import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import {
  COMMENT_ERROR_MESSAGES,
  COMMENT_MAX_LENGTH,
  createComment,
  deleteComment,
  getCommentOriginal,
  getPostComments,
  updateComment,
} from '../../api/posts.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime } from '../../utils/format.js'

// 저장·삭제 성공 응답을 재조회 전에 먼저 보여주기 위한 로컬 변경분.
// counted: 재조회한 서버 전체 개수(totalElements)가 이미 포함하고 있는 created 댓글 ID.
const NO_LOCAL_CHANGES = { created: [], updated: {}, deleted: [], counted: [] }

function describeCommentError(error, fallback) {
  if (error instanceof ApiError && COMMENT_ERROR_MESSAGES[error.code]) return COMMENT_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

// 서버 정렬(createdAt 오름차순, tie-breaker commentId 오름차순)과 같은 순서.
function byServerOrder(a, b) {
  const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  return diff !== 0 && !Number.isNaN(diff) ? diff : a.commentId - b.commentId
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all resize-none'

/**
 * 게시글 댓글(Cking-BE docs/domains/post/comment-api.md).
 * - 읽기: 게시글을 볼 수 있는 사람. 쓰기: 로그인 + 팔로워 또는 게시글 작성 크리에이터.
 * - 수정: 댓글 작성자 본인만. 삭제: 댓글 작성자 본인과 게시글 작성 크리에이터.
 * - 서버 페이지가 offset 방식이라 삭제 뒤에는 서버 목록과 다시 맞춘 뒤에만 '더 보기'를 연다.
 */
export default function PostComments({ creatorId, postId, authenticated, following, isMine, memberId, followDisabled, onFollow, onLogin }) {
  const showToast = useToast()
  const first = useAsync(
    () => getPostComments(creatorId, postId),
    [creatorId, postId],
    { fallbackMessage: '댓글을 불러오지 못했어요.' },
  )
  const [extra, setExtra] = useState({ pages: [], loading: false, error: '' })
  const [local, setLocal] = useState(NO_LOCAL_CHANGES)
  // 'synced' | 'refreshing' | 'failed'
  const [sync, setSync] = useState('synced')
  const generation = useRef(0)
  const loadingMore = useRef(false)
  const loadedPageCount = useRef(0)

  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [editing, setEditing] = useState(null) // { commentId, text }
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  // 필터링된 댓글에서 사용자가 펼친 원문. 요청 시점의 updatedAt과 함께 저장해, 그 뒤 댓글이 고쳐져 다시 판정되면 이전 원문을 쓰지 않는다.
  const [originals, setOriginals] = useState({})
  const revealing = useRef(new Set())

  const page = first.data
  const pages = page ? [page, ...extra.pages] : []
  const lastPage = pages.at(-1)
  useEffect(() => {
    loadedPageCount.current = pages.length
  })

  const seenIds = new Set()
  const loaded = pages.flatMap((item) => item.items ?? []).filter((comment) => {
    if (seenIds.has(comment.commentId)) return false
    seenIds.add(comment.commentId)
    return true
  })
  const deletedIds = new Set(local.deleted)
  const comments = [...loaded, ...local.created.filter((comment) => !seenIds.has(comment.commentId))]
    .filter((comment) => !deletedIds.has(comment.commentId))
    .map((comment) => local.updated[comment.commentId] ?? comment)
    .sort(byServerOrder)

  const canWrite = authenticated && (following || isMine)
  // 목록이 보일 때만 입력창을 연다: 최초 조회가 실패한 채 작성하면 저장은 되는데 오류 화면 때문에 결과가 보이지 않는다.
  const listReady = !first.loading && !first.error && page != null
  const isOwn = (comment) => memberId != null && Number(comment.authorMemberId) === Number(memberId)

  // 불러온 페이지를 처음부터 다시 읽어 서버 상태와 맞춘다. 실패해도 이미 보이는 댓글은 그대로 둔다.
  async function refreshQuietly() {
    const current = ++generation.current
    loadingMore.current = false
    // 이전 '더 보기' 오류는 지운다: 동기화가 끝나기 전에는 loadMore가 막혀 그 오류의 다시 시도가 동작하지 않는다.
    setExtra((state) => ({ ...state, loading: false, error: '' }))
    setSync('refreshing')
    try {
      const fetched = []
      for (let index = 0; index < Math.max(loadedPageCount.current, 1); index += 1) {
        fetched.push(await getPostComments(creatorId, postId, { page: index }))
        if (generation.current !== current) return
      }
      first.setData(fetched[0])
      setExtra({ pages: fetched.slice(1), loading: false, error: '' })
      // 방금 쓴 댓글이 아직 불러온 페이지에 없으면(예: 첫 페이지만 본 상태에서 21번째 댓글 작성) 목록에 계속 보인다.
      // 서버 순서대로 가져오면 이후 페이지에 들어오고, 그때는 중복 제거로 한 번만 보인다.
      const fetchedIds = new Set(fetched.flatMap((item) => (item.items ?? []).map((comment) => comment.commentId)))
      setLocal((state) => {
        // 그 사이 지웠거나 고친 댓글도 반영해서 남긴다(변경분은 이 시점에 비워지므로).
        const pending = state.created
          .filter((comment) => !fetchedIds.has(comment.commentId) && !state.deleted.includes(comment.commentId))
          .map((comment) => state.updated[comment.commentId] ?? comment)
        return { ...NO_LOCAL_CHANGES, created: pending, counted: pending.map((comment) => comment.commentId) }
      })
      setSync('synced')
    } catch {
      if (generation.current === current) {
        setSync('failed')
        showToast('댓글 목록을 새로 고치지 못했어요. 방금 변경한 내용은 반영되어 있어요.', { icon: 'error' })
      }
    }
  }

  async function loadMore() {
    if (!lastPage?.hasNext || loadingMore.current || sync !== 'synced') return
    loadingMore.current = true
    const current = generation.current
    setExtra((state) => ({ ...state, loading: true, error: '' }))
    try {
      const next = await getPostComments(creatorId, postId, { page: lastPage.page + 1 })
      if (generation.current !== current) return
      setExtra((state) => ({ pages: [...state.pages, next], loading: false, error: '' }))
    } catch (error) {
      if (generation.current !== current) return
      setExtra((state) => ({ ...state, loading: false, error: describeCommentError(error, '댓글을 더 불러오지 못했어요.') }))
    } finally {
      if (generation.current === current) loadingMore.current = false
    }
  }

  async function submitNew() {
    const content = draft.trim()
    if (!content || posting) return
    setPosting(true)
    setPostError('')
    try {
      const created = await createComment(creatorId, postId, content)
      setDraft('')
      setLocal((state) => ({ ...state, created: [...state.created, created] }))
      refreshQuietly()
    } catch (error) {
      setPostError(describeCommentError(error, '댓글을 남기지 못했어요.'))
    } finally {
      setPosting(false)
    }
  }

  async function submitEdit() {
    if (!editing || savingEdit) return
    const content = editing.text.trim()
    if (!content) return
    setSavingEdit(true)
    setEditError('')
    try {
      const updated = await updateComment(creatorId, postId, editing.commentId, content)
      setLocal((state) => ({ ...state, updated: { ...state.updated, [updated.commentId]: updated } }))
      setEditing(null)
      refreshQuietly()
    } catch (error) {
      setEditError(describeCommentError(error, '댓글을 수정하지 못했어요.'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function reveal(comment) {
    const { commentId, updatedAt } = comment
    if (revealing.current.has(commentId)) return
    revealing.current.add(commentId)
    setOriginals((state) => ({ ...state, [commentId]: { updatedAt, status: 'loading' } }))
    try {
      const original = await getCommentOriginal(creatorId, postId, commentId)
      setOriginals((state) => ({ ...state, [commentId]: { updatedAt, status: 'done', content: original.content } }))
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null
      setOriginals((state) => ({
        ...state,
        [commentId]: { updatedAt, status: 'error', code, message: describeCommentError(error, '원문을 불러오지 못했어요.') },
      }))
    } finally {
      revealing.current.delete(commentId)
    }
  }

  async function remove(comment) {
    if (deletingId != null) return
    if (!window.confirm('이 댓글을 삭제할까요? 삭제하면 되돌릴 수 없어요.')) return
    setDeletingId(comment.commentId)
    try {
      await deleteComment(creatorId, postId, comment.commentId)
      showToast('댓글을 삭제했어요.')
    } catch (error) {
      const gone = error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND'
      showToast(describeCommentError(error, '댓글을 삭제하지 못했어요.'), { icon: 'error' })
      if (!gone) {
        setDeletingId(null)
        return
      }
    }
    setLocal((state) => ({ ...state, deleted: [...state.deleted, comment.commentId] }))
    setDeletingId(null)
    refreshQuietly()
  }

  return (
    <section className="mt-space-md border-t border-surface-container pt-space-md" aria-label="댓글">
      <h4 className="mb-3 font-title-md text-title-md font-semibold text-on-surface">
        댓글 {page ? page.totalElements - local.deleted.length + local.created.filter((comment) => !local.counted.includes(comment.commentId)).length : ''}
      </h4>

      {first.loading && <LoadingBlock label="댓글을 불러오는 중..." />}
      {!first.loading && first.error && <ErrorBlock message={first.error} onRetry={first.reload} />}
      {!first.loading && !first.error && page && comments.length === 0 && (
        <EmptyBlock icon="chat_bubble" message="아직 댓글이 없어요." />
      )}

      {!first.loading && !first.error && page && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.commentId} className="rounded-xl bg-surface-container-low p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-label-md text-label-md font-semibold text-on-surface">{comment.authorName}</span>
                {comment.writtenByCreator && <StatusPill label="크리에이터" icon="verified" tone="bg-primary text-on-primary" />}
                <time className="font-label-xs text-label-xs text-outline" dateTime={comment.createdAt}>
                  {formatDateTime(comment.createdAt)}
                </time>
                {comment.updatedAt !== comment.createdAt && <span className="font-label-xs text-label-xs text-outline">수정됨</span>}
              </div>
              {editing?.commentId === comment.commentId ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editing.text}
                    maxLength={COMMENT_MAX_LENGTH}
                    rows={3}
                    aria-label="댓글 수정"
                    onChange={(event) => setEditing({ commentId: comment.commentId, text: event.target.value })}
                    className={inputClass}
                  />
                  {editError && <p className="font-label-xs text-label-xs text-error" role="alert">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setEditing(null); setEditError('') }} disabled={savingEdit} className="rounded-xl bg-surface-container px-3 py-2 font-label-sm text-label-sm text-on-surface disabled:opacity-60">
                      취소
                    </button>
                    <button type="button" onClick={submitEdit} disabled={savingEdit || !editing.text.trim()} className="rounded-xl bg-primary px-3 py-2 font-label-sm text-label-sm font-semibold text-on-primary disabled:opacity-60">
                      {savingEdit ? '저장하는 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {comment.filtered ? (
                    <FilteredComment
                      revealable={comment.revealable}
                      original={originals[comment.commentId]?.updatedAt === comment.updatedAt ? originals[comment.commentId] : undefined}
                      onReveal={() => reveal(comment)}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">{comment.content}</p>
                  )}
                  {authenticated && (isOwn(comment) || isMine) && (
                    <div className="mt-2 flex justify-end gap-3">
                      {/* 수정은 쓰기 권한이 있을 때만(팔로우를 끊은 작성자는 서버가 거절한다). 삭제는 팔로우와 무관하다. */}
                      {isOwn(comment) && canWrite && !comment.filtered && (
                        <button
                          type="button"
                          onClick={() => { setEditing({ commentId: comment.commentId, text: comment.content }); setEditError('') }}
                          disabled={deletingId === comment.commentId}
                          className="font-label-sm text-label-sm text-primary disabled:opacity-50"
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(comment)}
                        disabled={deletingId === comment.commentId}
                        className="font-label-sm text-label-sm text-error disabled:opacity-50"
                      >
                        {deletingId === comment.commentId ? '삭제하는 중...' : '삭제'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!first.loading && !first.error && page && lastPage?.hasNext && (
        sync === 'failed' ? (
          <button type="button" onClick={refreshQuietly} className="mt-3 w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface">
            목록을 새로 고쳐야 이어서 볼 수 있어요
          </button>
        ) : (
          <button
            type="button"
            onClick={loadMore}
            disabled={extra.loading || sync === 'refreshing'}
            className="mt-3 w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface disabled:opacity-60"
          >
            {extra.loading || sync === 'refreshing' ? '불러오는 중...' : '댓글 더 보기'}
          </button>
        )
      )}
      {extra.error && sync === 'synced' && <ErrorBlock message={extra.error} onRetry={loadMore} />}

      <div className="mt-space-md">
        {!authenticated && (
          <button type="button" onClick={onLogin} className="w-full rounded-xl bg-primary py-3 font-label-md text-label-md font-semibold text-on-primary">
            로그인하고 댓글 남기기
          </button>
        )}
        {authenticated && !canWrite && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-low px-4 py-5 text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">팔로워만 댓글을 쓸 수 있어요.</p>
            <button type="button" onClick={onFollow} disabled={followDisabled} className="rounded-xl bg-primary px-4 py-2 font-label-sm text-label-sm font-semibold text-on-primary disabled:opacity-60">
              팔로우하기
            </button>
          </div>
        )}
        {canWrite && listReady && (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              maxLength={COMMENT_MAX_LENGTH}
              rows={3}
              aria-label="댓글 입력"
              placeholder="댓글을 남겨보세요."
              onChange={(event) => setDraft(event.target.value)}
              className={inputClass}
            />
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-outline">{draft.length}/{COMMENT_MAX_LENGTH}</span>
              <button
                type="button"
                onClick={submitNew}
                disabled={posting || !draft.trim()}
                className="rounded-xl bg-primary px-4 py-2 font-label-sm text-label-sm font-semibold text-on-primary disabled:opacity-60"
              >
                {posting ? '남기는 중...' : '댓글 남기기'}
              </button>
            </div>
            {postError && <p className="font-label-xs text-label-xs text-error" role="alert">{postError}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * 필터가 차단해 원문이 가려진 댓글(Cking-BE comment-api.md '필터링').
 * - revealable: '필터링한 댓글 보기'로 원문을 받아 펼친다. 개인정보로 막힌 댓글은 false라 안내만 보여준다.
 * - 판정 사유는 사용자에게 알리지 않는다.
 */
function FilteredComment({ revealable, original, onReveal }) {
  const notRevealable = !revealable || original?.code === 'COMMENT_NOT_REVEALABLE'
  // 판정만 바뀌어 revealable이 false가 된 댓글은 updatedAt이 그대로라 캐시가 남아 있을 수 있다. 펼쳐 둔 원문도 숨긴다.
  if (revealable && original?.status === 'done') {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1 font-label-xs text-label-xs text-outline">
          <MaterialIcon name="visibility" className="text-[14px]" />
          필터링된 댓글의 원문이에요
        </p>
        <p className="whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">{original.content}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
        <MaterialIcon name="visibility_off" className="text-[16px] text-outline" />
        {notRevealable ? '볼 수 없는 댓글이에요.' : '필터링된 댓글이에요.'}
      </p>
      {!notRevealable && (
        <button
          type="button"
          onClick={onReveal}
          disabled={original?.status === 'loading'}
          className="font-label-sm text-label-sm text-primary disabled:opacity-50"
        >
          {original?.status === 'loading' ? '불러오는 중...' : '필터링한 댓글 보기'}
        </button>
      )}
      {original?.status === 'error' && original.code !== 'COMMENT_NOT_REVEALABLE' && (
        <p className="font-label-xs text-label-xs text-error" role="alert">{original.message}</p>
      )}
    </div>
  )
}
