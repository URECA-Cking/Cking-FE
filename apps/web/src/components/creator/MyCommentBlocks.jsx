import { useRef, useState } from 'react'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getCommentBlocks, releaseCommentBlock } from '../../api/creatorCommentBlocks.js'
import { BLOCK_STATUS_LABELS, blockStatus, commentBlockErrorMessage } from '../../utils/commentBlocks.js'
import { formatDateTime } from '../../utils/format.js'
import { ceilToMinute } from '../../utils/sanctionNotice.js'

const PAGE_SIZE = 20
const NO_MORE_PAGES = { items: [], nextPage: 1, hasNext: null, loading: false, error: '' }
const STATUS_TONES = {
  ACTIVE: 'bg-primary text-on-primary',
  RELEASED: 'bg-surface-container text-on-surface-variant',
  EXPIRED: 'bg-surface-container text-on-surface-variant',
}

/**
 * 내 스페이스 "차단 관리" 탭(Creator 전용). 내가 건 스페이스 댓글 차단을 최신순으로 보고 해제한다.
 * 계약: Cking-BE docs/domains/sanction/api.md '크리에이터 스페이스 댓글 차단 API'. 차단은 댓글의 "이 회원 차단" 메뉴에서 건다.
 */
export default function MyCommentBlocks() {
  const [activeOnly, setActiveOnly] = useState(true)
  return (
    <div className="flex flex-col gap-space-sm px-margin py-space-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-title-md text-title-md font-semibold text-on-surface">댓글 차단 관리</h2>
        <label className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
          <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="accent-primary" />
          차단 중인 회원만
        </label>
      </div>
      {/* 필터가 바뀌면 이어 읽은 페이지와 해제 중 상태를 버리도록 key로 새로 시작한다. */}
      <BlockList key={String(activeOnly)} activeOnly={activeOnly} />
    </div>
  )
}

function BlockList({ activeOnly }) {
  const showToast = useToast()
  const { data, loading, error, reload, setData } = useAsync(
    () => getCommentBlocks({ activeOnly, page: 0, size: PAGE_SIZE }),
    [activeOnly],
    { fallbackMessage: '차단 목록을 불러오지 못했어요.' },
  )
  const [more, setMore] = useState(NO_MORE_PAGES)
  // 이어 읽는 중에 목록이 바뀌면(해제 후 다시 맞춤) 늦게 도착한 옛 응답을 버리기 위한 세대 번호.
  const generation = useRef(0)
  const [releasingId, setReleasingId] = useState(null)

  const hasNext = more.hasNext ?? Boolean(data?.hasNext)
  const items = [...(data?.items ?? []), ...more.items]

  async function loadMore() {
    // loading: 해제 뒤 첫 페이지를 다시 읽는 중이면 페이지 경계가 아직 맞지 않아 이어 읽지 않는다.
    if (more.loading || loading || !hasNext) return
    const current = generation.current
    setMore((state) => ({ ...state, loading: true, error: '' }))
    try {
      const response = await getCommentBlocks({ activeOnly, page: more.nextPage, size: PAGE_SIZE })
      if (generation.current !== current) return
      setMore((state) => ({
        items: [...state.items, ...(response?.items ?? [])],
        nextPage: state.nextPage + 1,
        hasNext: Boolean(response?.hasNext),
        loading: false,
        error: '',
      }))
    } catch (loadError) {
      if (generation.current !== current) return
      setMore((state) => ({ ...state, loading: false, error: commentBlockErrorMessage(loadError, '차단 목록을 더 불러오지 못했어요.') }))
    }
  }

  async function release(block) {
    if (releasingId !== null) return
    if (!window.confirm(`${block.memberName ?? '이 회원'}의 차단을 해제할까요?`)) return
    setReleasingId(block.sanctionId)
    try {
      const released = await releaseCommentBlock(block.sanctionId)
      showToast('차단을 해제했어요.')
      if (activeOnly) {
        // 서버 페이지는 offset 방식이라, 활성 목록에서 한 건이 빠지면 뒤 항목이 앞으로 당겨져 이어 읽을 때 한 건씩 건너뛴다.
        // 해당 항목을 바로 빼서 보여주고, 이어 읽은 페이지는 버린 뒤 첫 페이지를 서버 목록과 다시 맞춘다.
        generation.current += 1
        setData((prev) => (prev ? { ...prev, items: prev.items.filter((item) => item.sanctionId !== block.sanctionId) } : prev))
        setMore(NO_MORE_PAGES)
        reload()
      } else {
        // 전체 보기는 해제해도 순서와 개수가 그대로라 해당 항목만 응답으로 바꾼다.
        const apply = (list) => list.map((item) => (item.sanctionId === block.sanctionId ? released : item))
        setData((prev) => (prev ? { ...prev, items: apply(prev.items) } : prev))
        setMore((state) => ({ ...state, items: apply(state.items) }))
      }
    } catch (releaseError) {
      showToast(commentBlockErrorMessage(releaseError, '차단을 해제하지 못했어요.'), { icon: 'error' })
    } finally {
      setReleasingId(null)
    }
  }

  // 해제 뒤 다시 읽는 동안에는 이미 보이는 목록을 그대로 두고, 처음 읽을 때만 로딩 표시를 한다.
  if (loading && !data) return <LoadingBlock label="차단 목록을 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (items.length === 0) {
    return (
      <EmptyBlock
        icon="block"
        message={activeOnly ? '차단 중인 회원이 없어요.' : '차단한 기록이 없어요.'}
      />
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((block) => {
          const status = blockStatus(block)
          return (
            <li key={block.sanctionId} className="flex items-start gap-3 rounded-xl bg-surface-container-low p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">{block.memberName ?? '알 수 없는 회원'}</span>
                  <StatusPill label={BLOCK_STATUS_LABELS[status]} tone={STATUS_TONES[status]} />
                </div>
                <p className="mt-1 font-label-xs text-label-xs text-outline">
                  {formatDateTime(block.startedAt)} ~ {formatDateTime(ceilToMinute(new Date(block.endsAt)))}
                  {block.releasedAt ? ` · ${formatDateTime(block.releasedAt)} 해제` : ''}
                </p>
              </div>
              {status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => release(block)}
                  disabled={releasingId !== null}
                  className="shrink-0 rounded-xl bg-surface-container px-3 py-2 font-label-sm text-label-sm font-semibold text-on-surface disabled:opacity-50"
                >
                  {releasingId === block.sanctionId ? '해제하는 중...' : '해제'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {more.error && <p className="font-label-xs text-label-xs text-error" role="alert">{more.error}</p>}
      {hasNext && (
        <button
          type="button"
          onClick={loadMore}
          disabled={more.loading || loading}
          className="w-full rounded-xl bg-surface-container py-3 font-label-md text-label-md text-on-surface disabled:opacity-60"
        >
          {more.loading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </>
  )
}
