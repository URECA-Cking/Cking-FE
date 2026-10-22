import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import CommentBlockSheet from './CommentBlockSheet.jsx'
import CommentMoreMenu from './CommentMoreMenu.jsx'
import CommentReportSheet from './CommentReportSheet.jsx'
import ConfirmSheet from '../ui/ConfirmSheet.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import {
  COMMENT_ERROR_MESSAGES,
  COMMENT_MAX_LENGTH,
  COMMENT_REPORT_ERROR_MESSAGES,
  createComment,
  deleteComment,
  getCommentOriginal,
  getPostComments,
  updateComment,
} from '../../api/posts.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useProfileSetupRedirect } from '../../hooks/useProfileSetupRedirect.js'
import { formatDateTime } from '../../utils/format.js'
import { ceilToMinute, describeCommentRestriction } from '../../utils/sanctionNotice.js'
import { createCommentBlockAsAdmin, deleteCommentAsAdmin } from '../../api/adminComments.js'
import { createCommentBlock } from '../../api/creatorCommentBlocks.js'
import { useUser } from '../../context/useUser.js'
import { canBlockAuthor, canDeleteComment, deleteRoute, moderationActor } from '../../utils/commentModeration.js'

// 저장·삭제 성공 응답을 재조회 전에 먼저 보여주기 위한 로컬 변경분.
// deleted: 목록에서 숨길 댓글 ID.
const NO_LOCAL_CHANGES = { created: [], updated: {}, deleted: [] }

function describeCommentError(error, fallback) {
  // 작성·수정 제한(플랫폼 제한·스페이스 차단)은 BE 메시지의 UTC 해제 시각을 앱 공통 시각 표기(브라우저 시간대)로 바꿔 안내한다.
  if (error instanceof ApiError) {
    const restriction = describeCommentRestriction(error.code, error.message)
    if (restriction) return restriction
  }
  if (error instanceof ApiError && COMMENT_ERROR_MESSAGES[error.code]) return COMMENT_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

// 서버 정렬(createdAt 오름차순, tie-breaker commentId 오름차순)과 같은 순서.
function byServerOrder(a, b) {
  const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  return diff !== 0 && !Number.isNaN(diff) ? diff : a.commentId - b.commentId
}

// 새 댓글 입력창. 한 줄일 때 오른쪽 전송 버튼과 위아래 여백이 같도록 위아래 패딩을 넉넉히 둔다.
const draftClass =
  'w-full max-h-40 overflow-y-auto pl-3 pr-14 py-4 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all resize-none'
const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all resize-none'

/**
 * 게시글 댓글(Cking-BE docs/domains/post/comment-api.md).
 * - 읽기: 게시글을 볼 수 있는 사람. 쓰기: 로그인 + 팔로워 또는 게시글 작성 크리에이터.
 * - 수정: 댓글 작성자 본인만. 삭제: 댓글 작성자 본인과 게시글 작성 크리에이터.
 * - 서버 페이지가 offset 방식이라 삭제 뒤에는 서버 목록과 다시 맞춘 뒤에만 '더 보기'를 연다.
 */
export default function PostComments({ creatorId, postId, authenticated, following, isMine, memberId, followDisabled, onFollow, onLogin, onPostRestricted, onCommentCountChange, onCommentCountSync, keyboardInset = 0 }) {
  const showToast = useToast()
  const { isAdmin } = useUser()
  const redirectToProfileSetup = useProfileSetupRedirect()
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
  // 한 줄 높이로 시작해 입력한 만큼 늘리고(최대 max-h-40), 비우면 다시 한 줄로 줄인다.
  const draftRef = useRef(null)
  useEffect(() => {
    const box = draftRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight}px`
  }, [draft])
  // 키보드가 올라와 아래 여백이 생기면, 입력 중인 칸(새 댓글·댓글 수정)이 키보드에 가려지지 않게 보이는 곳으로 올린다.
  useEffect(() => {
    const active = document.activeElement
    if (keyboardInset > 0 && active instanceof HTMLTextAreaElement) active.scrollIntoView({ block: 'nearest' })
  }, [keyboardInset])
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [editing, setEditing] = useState(null) // { commentId, text }
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  // 삭제 확인 시트를 연 댓글(없으면 null). 삭제 요청이 끝날 때까지 시트를 유지해 처리 중 표시를 한다.
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  // 신고 창을 연 댓글 ID(없으면 null).
  const [reportingId, setReportingId] = useState(null)
  const [blockingMember, setBlockingMember] = useState(null) // { memberId, name } 크리에이터가 차단하려는 작성자
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
  // 본인 댓글과, 필터 차단·관리자 숨김으로 이미 가려진 댓글은 신고할 수 없다(BE가 COMMENT_REPORT_ALREADY_FILTERED로 거절한다).
  const canReport = (comment) => !isOwn(comment) && !comment.filtered
  // 남의 댓글을 조치(차단·삭제)할 자격. 게시글 주인(크리에이터)이 우선이고, 아니면 관리자다. 호출하는 API만 다르다.
  const actor = moderationActor({ isMine, isAdmin })

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
      if (typeof fetched[0].totalElements === 'number') onCommentCountSync?.(fetched[0].totalElements)
      // 방금 쓴 댓글이 아직 불러온 페이지에 없으면(예: 첫 페이지만 본 상태에서 21번째 댓글 작성) 목록에 계속 보인다.
      // 서버 순서대로 가져오면 이후 페이지에 들어오고, 그때는 중복 제거로 한 번만 보인다.
      const fetchedIds = new Set(fetched.flatMap((item) => (item.items ?? []).map((comment) => comment.commentId)))
      setLocal((state) => {
        // 그 사이 지웠거나 고친 댓글도 반영해서 남긴다(변경분은 이 시점에 비워지므로).
        const pending = state.created
          .filter((comment) => !fetchedIds.has(comment.commentId) && !state.deleted.includes(comment.commentId))
          .map((comment) => state.updated[comment.commentId] ?? comment)
        return { ...NO_LOCAL_CHANGES, created: pending }
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
      onCommentCountChange?.(1)
      refreshQuietly()
    } catch (error) {
      // 닉네임을 설정하지 않았으면 프로필 설정 화면으로 보낸다. 작성하던 내용은 돌아왔을 때 다시 쓴다.
      if (redirectToProfileSetup(error)) return
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
      if (redirectToProfileSetup(error)) return
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

  // 관리자 권한으로 지우는 댓글이면 확인 문구가 달라진다(작성자에게 경고·알림이 가지 않는다).
  const deleteByAdmin = confirmingDelete !== null && deleteRoute({ actor, isOwn: isOwn(confirmingDelete) }) === 'admin'

  /** 삭제 버튼을 누르면 바로 지우지 않고 확인 시트를 연다. */
  function askRemove(comment) {
    if (deletingId != null) return
    setConfirmingDelete(comment)
  }

  async function remove(comment) {
    if (deletingId != null) return
    const route = deleteRoute({ actor, isOwn: isOwn(comment) })
    setDeletingId(comment.commentId)
    // 내 삭제 요청이 성공(204)했을 때만 true. 404(이미 삭제됨)는 행만 숨기고 댓글 수는 그대로 둔 채 재조회로 맞춘다.
    let deletedByMe = false
    try {
      // 관리자는 게시글·소유 관계를 따지지 않는 관리자 API를 쓰고, 본인 댓글과 게시글 주인의 삭제는 기존 API를 쓴다.
      if (route === 'admin') await deleteCommentAsAdmin(comment.commentId)
      else await deleteComment(creatorId, postId, comment.commentId)
      deletedByMe = true
      showToast('댓글을 삭제했어요.')
    } catch (error) {
      const gone = error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND'
      // 삭제는 작성 제한의 대상이 아니라서 제한 오류(COMMENT_RESTRICTED 등)는 오지 않는다. 공통 문구 매핑만 쓴다.
      showToast(describeCommentError(error, '댓글을 삭제하지 못했어요.'), { icon: 'error' })
      if (!gone) {
        setDeletingId(null)
        setConfirmingDelete(null)
        return
      }
    }
    setLocal((state) => ({
      ...state,
      deleted: [...state.deleted, comment.commentId],
    }))
    // 부모(목록 카드·상세)의 댓글 수는 내 삭제가 성공했을 때만 줄인다.
    if (deletedByMe) onCommentCountChange?.(-1)
    setDeletingId(null)
    setConfirmingDelete(null)
    refreshQuietly()
  }

  return (
    <section className="mt-space-md border-t border-surface-container pt-space-md" aria-label="댓글">
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
                {/* 가려진 댓글은 작성자가 아닌 조회자에게 이름·사진이 null로 오므로 이름 자리에 안내 문구를 둔다. */}
                <span className="h-7 w-7 shrink-0">
                  <ProfilePhoto src={comment.authorProfileImageUrl} className="h-full w-full" />
                </span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">{comment.authorName ?? '가려진 댓글'}</span>
                {comment.writtenByCreator && <StatusPill label="크리에이터" icon="verified" tone="bg-primary text-on-primary" />}
                <time className="font-label-xs text-label-xs text-outline" dateTime={comment.createdAt}>
                  {formatDateTime(comment.createdAt)}
                </time>
                {comment.updatedAt !== comment.createdAt && <span className="font-label-xs text-label-xs text-outline">수정됨</span>}
                {/* 크리에이터가 남의 댓글 작성자를 내 스페이스에서 차단한다. 가려진 댓글도 authorMemberId는 내려온다. */}
                {canBlockAuthor({ authenticated, actor, isOwn: isOwn(comment), authorMemberId: comment.authorMemberId, writtenByCreator: comment.writtenByCreator }) && (
                  <CommentMoreMenu onBlock={() => setBlockingMember({ memberId: comment.authorMemberId, name: comment.authorName })} />
                )}
              </div>
              {editing?.commentId === comment.commentId ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    data-clarity-mask="True"
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
                      canReveal={isMine || isAdmin}
                      // 관리자에게는 개인정보 차단·관리자 숨김 댓글도 열린다. 스페이스 주인에게는 BE의 revealable을 따른다.
                      revealable={isAdmin || (isMine && comment.revealable)}
                      original={originals[comment.commentId]?.updatedAt === comment.updatedAt ? originals[comment.commentId] : undefined}
                      onReveal={() => reveal(comment)}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">{comment.content}</p>
                  )}
                  {(canDeleteComment({ authenticated, actor, isOwn: isOwn(comment) }) || canReport(comment)) && (
                    <div className="mt-2 flex justify-end gap-3">
                      {/* 수정은 쓰기 권한이 있을 때만(팔로우를 끊은 작성자는 서버가 거절한다). 삭제는 팔로우와 무관하다. */}
                      {isOwn(comment) && canWrite && (
                        <button
                          type="button"
                          onClick={() => { setEditing({ commentId: comment.commentId, text: comment.content }); setEditError('') }}
                          disabled={deletingId === comment.commentId}
                          className="font-label-sm text-label-sm text-primary disabled:opacity-50"
                        >
                          수정
                        </button>
                      )}
                      {canDeleteComment({ authenticated, actor, isOwn: isOwn(comment) }) && (
                        <button
                          type="button"
                          onClick={() => askRemove(comment)}
                          disabled={deletingId === comment.commentId}
                          className="font-label-sm text-label-sm text-error disabled:opacity-50"
                        >
                          {deletingId === comment.commentId ? '삭제하는 중...' : '삭제'}
                        </button>
                      )}
                      {/* 본인 댓글은 신고할 수 없다(BE도 거절한다). 비로그인이면 로그인 안내로 보낸다. */}
                      {canReport(comment) && (
                        <button
                          type="button"
                          onClick={() => (authenticated ? setReportingId(comment.commentId) : onLogin())}
                          className="font-label-sm text-label-sm text-on-surface-variant"
                        >
                          신고
                        </button>
                      )}
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
            <p className="font-body-sm text-body-sm text-on-surface-variant">팬만 댓글을 쓸 수 있어요.</p>
            <button type="button" onClick={onFollow} disabled={followDisabled} className="rounded-xl bg-primary px-4 py-2 font-label-sm text-label-sm font-semibold text-on-primary disabled:opacity-60">
              도킹하기
            </button>
          </div>
        )}
        {canWrite && listReady && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <textarea
                data-clarity-mask="True"
                value={draft}
                maxLength={COMMENT_MAX_LENGTH}
                ref={draftRef}
                rows={1}
                aria-label="댓글 입력"
                placeholder="댓글을 남겨보세요."
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter는 등록, Shift+Enter는 줄바꿈. 한글 조합 중 Enter는 글자 확정이라 등록하지 않는다.
                  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  submitNew()
                }}
                className={draftClass}
              />
              {draft.trim() && (
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={posting}
                  aria-label={posting ? '댓글을 남기는 중' : '댓글 남기기'}
                  className="absolute right-3 top-2.5 flex h-8 w-9 items-center justify-center rounded-xl bg-primary text-on-primary disabled:opacity-60"
                >
                  <MaterialIcon name="arrow_upward" className="text-[20px]" />
                </button>
              )}
            </div>
            {postError && <p className="font-label-xs text-label-xs text-error" role="alert">{postError}</p>}
          </div>
        )}
      </div>
      <ConfirmSheet
        open={confirmingDelete !== null}
        title={deleteByAdmin ? '관리자 권한으로 댓글을 삭제할까요?' : '댓글을 삭제할까요?'}
        message={deleteByAdmin ? '되돌릴 수 없고, 작성자에게 경고나 알림은 가지 않아요.' : '삭제하면 되돌릴 수 없어요.'}
        busy={deletingId !== null}
        onConfirm={() => remove(confirmingDelete)}
        onClose={() => setConfirmingDelete(null)}
      />
      {blockingMember !== null && (
        <CommentBlockSheet
          memberName={blockingMember.name}
          createBlock={(days) => (actor === 'admin'
            ? createCommentBlockAsAdmin({ creatorId, memberId: blockingMember.memberId, days })
            : createCommentBlock({ memberId: blockingMember.memberId, days }))}
          onClose={() => setBlockingMember(null)}
          onBlocked={(block) => {
            const target = blockingMember.name || '이 회원'
            setBlockingMember(null)
            // 이미 유효한 차단이 있으면 기존 차단이 돌아온다. 요청한 기간이 아니라 돌려받은 종료 시각을 안내한다.
            showToast(`${target}을(를) ${formatDateTime(ceilToMinute(new Date(block.endsAt)))}까지 차단했어요.`)
          }}
        />
      )}
      {reportingId !== null && (
        <CommentReportSheet
          creatorId={creatorId}
          postId={postId}
          commentId={reportingId}
          onClose={() => setReportingId(null)}
          onReported={() => {
            setReportingId(null)
            showToast('신고가 접수됐어요.')
          }}
          onGone={(error) => {
            setReportingId(null)
            showToast(COMMENT_REPORT_ERROR_MESSAGES[error.code] ?? '신고할 수 없는 댓글이에요.', { icon: 'error' })
            // 삭제된 댓글이면 목록에서도 사라지도록 서버 목록과 다시 맞춘다.
            if (error.code === 'RESOURCE_NOT_FOUND') refreshQuietly()
            // 팔로우가 풀려 글을 더 볼 수 없으면 이미 떠 있는 상세와 댓글을 부모가 닫고 권한을 다시 확인한다.
            if (error.code === 'POST_FOLLOWERS_ONLY') onPostRestricted?.()
          }}
        />
      )}
    </section>
  )
}

/**
 * 필터가 차단해 원문이 가려진 댓글(Cking-BE comment-api.md '필터링').
 * - 필터링된 댓글은 모든 조회자에게 자리 표시로 보이고(작성자 본인은 filtered=false), 원문은 스페이스 주인과 관리자만 받는다.
 * - canReveal: 스페이스 주인·관리자. 아니면 자리 표시만 보이고 원문을 요청하지 않는다.
 * - revealable: '필터링한 댓글 보기'로 원문을 받아 펼친다. 개인정보로 막힌 댓글은 주인에게 false라 안내만 보여준다.
 * - 판정 사유는 사용자에게 알리지 않는다.
 */
function FilteredComment({ canReveal, revealable, original, onReveal }) {
  // 펼친 원문을 다시 가린 상태. 받아 둔 원문은 버리지 않아 다시 보면 요청 없이 펼친다.
  const [collapsed, setCollapsed] = useState(false)
  const notRevealable = !revealable || original?.code === 'COMMENT_NOT_REVEALABLE'
  // 원문을 열 수 있는 사람(주인·관리자)에게만 '볼 수 없는 댓글'로 구분해 안내한다. 그 외에는 모두 같은 자리 표시다.
  const unavailable = canReveal && notRevealable
  // 판정만 바뀌어 revealable이 false가 된 댓글은 updatedAt이 그대로라 캐시가 남아 있을 수 있다. 펼쳐 둔 원문도 숨긴다.
  if (revealable && original?.status === 'done' && !collapsed) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1 font-label-xs text-label-xs text-outline">
          <MaterialIcon name="visibility" className="text-[14px]" />
          필터링된 댓글의 원문이에요
        </p>
        <p className="whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">{original.content}</p>
        <button type="button" onClick={() => setCollapsed(true)} className="self-start font-label-sm text-label-sm text-primary">
          다시 가리기
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
        <MaterialIcon name="visibility_off" className="text-[16px] text-outline" />
        {unavailable ? '볼 수 없는 댓글이에요.' : '필터링된 댓글이에요.'}
      </p>
      {canReveal && !notRevealable && (
        <button
          type="button"
          onClick={() => {
            setCollapsed(false)
            if (original?.status !== 'done') onReveal()
          }}
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
