import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getTicketHistory } from '../../api/tickets.js'
import { describeError } from '../../api/client.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'
import { TICKET_LEDGER_TYPE_META } from '../../utils/eventStatus.js'

// 원장 한 줄의 제목. "적립 · 공유"처럼 종류 이름을 늘어놓지 않고 무엇을 했는지 한 덩어리로 읽히게 한다.
// 미션·이벤트 이름이 응답에 없으면 번호 없이 "적립"·"이벤트 응모"로만 쓴다.
function ledgerTitle(item, fallbackLabel) {
  if (item.type === 'EARN' && item.missionId) return item.missionName ? `${item.missionName} 완료` : '적립'
  if (item.type === 'SPEND' && item.eventId) return `${item.eventTitle ?? '이벤트'} 응모`
  return fallbackLabel
}

// 미션 종류별 아이콘. 스페이스의 미션 카드와 같은 모양을 쓰고, 출석체크는 카드가 없어 달력 체크를 쓴다.
// 응답에는 type이 아니라 표시 이름(missionName)만 와서 이름으로 고른다. 모르는 이름은 적립 기본 아이콘이다.
const MISSION_ICONS = { 출석체크: 'event_available', 좋아요: 'favorite', 공유: 'share', '유튜브 구독': 'subscriptions' }

// 표시용 상대 시간. 일주일이 지나면 정확한 날짜를 보여준다.
function formatAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}일 전`
  return formatDateTime(iso)
}

/**
 * 응모권 적립·사용 내역 시트.
 *
 * GET /api/creators/{creatorId}/tickets/history 는 커서 페이지네이션이라
 * 첫 페이지는 시트가 열릴 때 한 번 읽고, nextCursor가 있는 동안 "더 보기"로 이어 붙인다.
 */
export default function TicketLedgerSheet({ open, onClose, creatorId, creatorName, balance }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="응모권 내역">
      <div className="flex items-center justify-between p-space-md rounded-xl bg-berry-tint mb-space-md">
        <div className="min-w-0">
          <p className="font-label-xs text-label-xs text-berry-deep font-semibold">{creatorName} 전용 응모권</p>
          <p data-clarity-mask="True" className="font-metric-display text-metric-display text-primary font-extrabold">
            {formatNumber(balance)}장
          </p>
        </div>
        <MaterialIcon name="confirmation_number" className="text-primary text-[32px]" />
      </div>

      {/* 시트가 열릴 때마다 새로 마운트되어 항상 첫 페이지부터 다시 읽는다. */}
      <LedgerList creatorId={creatorId} />
    </BottomSheet>
  )
}

function LedgerList({ creatorId }) {
  const [extraPages, setExtraPages] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(null)

  const { data, loading, error, reload } = useAsync(
    () => getTicketHistory(creatorId, { size: 20 }),
    [creatorId],
    { enabled: Boolean(creatorId), fallbackMessage: '응모권 내역을 불러오지 못했습니다.' },
  )

  const items = [...(data?.items ?? []), ...extraPages.flatMap((page) => page.items ?? [])]
  const last = extraPages.length > 0 ? extraPages[extraPages.length - 1] : data
  const hasNext = Boolean(last?.hasNext && last?.nextCursor)

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await getTicketHistory(creatorId, { size: 20, cursor: last.nextCursor })
      setExtraPages((prev) => [...prev, page])
    } catch (err) {
      setMoreError(describeError(err, '다음 내역을 불러오지 못했습니다.'))
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) return <LoadingBlock label="내역을 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (items.length === 0) return <EmptyBlock icon="receipt_long" message="아직 응모권 적립·사용 내역이 없어요." />

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const meta = TICKET_LEDGER_TYPE_META[item.type] ?? {
            label: '내역',
            icon: 'circle',
            tone: 'text-outline',
          }
          const positive = (item.deltaAmount ?? 0) >= 0
          return (
            <li
              key={item.ledgerId}
              className="flex items-center gap-space-sm p-space-sm rounded-xl bg-surface-container-low"
            >
              <div
                className={`w-9 h-9 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0 ${meta.tone}`}
              >
                <MaterialIcon name={(item.type === 'EARN' && MISSION_ICONS[item.missionName]) || meta.icon} className="text-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                  {ledgerTitle(item, meta.label)}
                </p>
                <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
                  {formatAgo(item.createdAt)}
                </p>
              </div>
              <span
                className={`font-label-md text-label-md font-bold shrink-0 ${
                  positive ? 'text-success-text' : 'text-primary'
                }`}
              >
                {positive ? '+' : ''}
                {formatNumber(item.deltaAmount)}장
              </span>
            </li>
          )
        })}
      </ul>

      {moreError && <p className="mt-space-sm font-label-xs text-label-xs text-error text-center">{moreError}</p>}

      {hasNext && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={loadMore}
          className="mt-space-md w-full h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loadingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </>
  )
}
