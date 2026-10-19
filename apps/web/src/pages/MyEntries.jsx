import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../components/ui/States.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { loadMyEntries } from '../api/myEntries.js'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import { useCreatorCatalog } from '../hooks/useCreatorProfile.js'
import { formatDday, formatNumber } from '../utils/format.js'
import { eventStatusMeta } from '../utils/eventStatus.js'

// 응모 이력이 쌓이면 지금 응모할 수 있는 이벤트와 끝난 이벤트를 나눠 본다. 기준은 BE가 내려준 displayStatus다.
const ENTRY_FILTERS = [
  { id: '', label: '전체' },
  { id: 'IN_PROGRESS', label: '응모 중' },
  { id: 'CLOSED', label: '종료' },
]

// 이력이 많아도 화면이 길어지지 않게 이만큼씩 보여 준다. "더보기"로 늘리고, 끝까지 펼치면 같은 자리의 "접기"로 되돌린다.
const ENTRY_PAGE_SIZE = 5

/**
 * 내 응모 현황.
 *
 * 백엔드는 "내 응모 목록" API를 제공하지만 아직 연동하지 않아, 응모 시 기록되는 응모권 원장(SPEND + eventId)을
 * 이벤트 단위로 모아 실제 응모 내역을 보여준다. 결과가 공개된 이벤트는
 * GET /api/events/{eventId}/winners 로 내 당첨 여부까지 확인한다.
 */
export default function MyEntries() {
  const creatorCatalog = useCreatorCatalog()
  const { data, loading, error, reload } = useAsync(() => loadMyEntries(), [], {
    fallbackMessage: '응모 내역을 불러오지 못했습니다.',
  })

  const [filter, setFilter] = useState('')
  const [shownCount, setShownCount] = useState(ENTRY_PAGE_SIZE)
  const entries = data?.entries ?? []
  const countOf = (id) => (id ? entries.filter((entry) => entry.event?.displayStatus === id).length : entries.length)
  const filteredEntries = filter ? entries.filter((entry) => entry.event?.displayStatus === filter) : entries
  const visibleEntries = filteredEntries.slice(0, shownCount)
  const hiddenCount = filteredEntries.length - visibleEntries.length

  return (
    <div className="flex min-h-full flex-col w-full px-margin pt-space-md pb-8 gap-space-md md:mx-auto md:max-w-5xl md:px-8">
      {!loading && !error && (data?.failedEventCount > 0 || data?.winnersFailed) && (
        <div className="flex items-center gap-2 p-space-sm rounded-xl bg-surface-container-lowest text-on-surface-variant">
          <MaterialIcon name="warning" className="text-[18px] text-primary shrink-0" />
          <p className="font-label-xs text-label-xs leading-relaxed flex-1">
            {data.failedEventCount > 0 && `이벤트 ${data.failedEventCount}개의 응모 내역을 불러오지 못했어요. `}
            {data.winnersFailed && '일부 당첨 결과를 확인하지 못했어요.'}
          </p>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-xs text-label-xs font-semibold active:scale-95 transition-all"
          >
            다시 시도
          </button>
        </div>
      )}

      {loading && <LoadingBlock label="응모 내역을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyBlock
            icon="confirmation_number"
            message="아직 응모한 이벤트가 없어요. 진행 중인 이벤트에 응모해보세요!"
            messageClassName="text-[12px]"
            action={
              <Link
                to="/explore?tab=event"
                className="mt-1 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-95 transition-all"
              >
                이벤트 둘러보기
              </Link>
            }
          />
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="flex overflow-x-auto gap-2 no-scrollbar py-1">
          {ENTRY_FILTERS.map((item) => (
            <button
              key={item.id || 'all'}
              type="button"
              onClick={() => {
                setFilter(item.id)
                setShownCount(ENTRY_PAGE_SIZE)
              }}
              aria-pressed={filter === item.id}
              className={`px-4 py-1.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                filter === item.id
                  ? 'bg-inverse-surface text-inverse-on-surface shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {item.label} {formatNumber(countOf(item.id))}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && entries.length > 0 && filteredEntries.length === 0 && (
        <EmptyBlock
          icon="confirmation_number"
          message={filter === 'IN_PROGRESS' ? '지금 응모 중인 이벤트가 없어요.' : '종료된 이벤트가 없어요.'}
        />
      )}

      <div className="flex flex-col md:grid md:grid-cols-2 gap-space-sm">
        {visibleEntries.map((entry) => {
          const event = entry.event
          const creator = creatorCatalog.get(event?.creatorId) ?? { name: '크리에이터' }
          const statusMeta = event ? eventStatusMeta(event.status) : null
          const won = Boolean(entry.myWin)
          // 응모 중인 이벤트만 마감까지 남은 날을 힌트로 보여 준다. 클라이언트 시각 기준이라 이미 지났으면(서버 캐시로 아직 진행 중) 숨긴다.
          const dday = event?.displayStatus === 'IN_PROGRESS' ? formatDday(event.endAt) : ''
          const showDday = dday.startsWith('D-')

          return (
            <Link
              key={entry.eventId}
              to={`/events/${entry.eventId}`}
              className={`p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm active:scale-[0.99] transition-all ${
                won ? 'border border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-space-md">
                {/* 정방형 미리보기는 이벤트 배너 대신 크리에이터 사진이다. 진행 중인 이벤트는 탐색 크리에이터 목록처럼 링으로 강조한다. */}
                <ProfilePhoto
                  src={creator.avatar}
                  className={`h-16 w-16 shrink-0 ${event?.displayStatus === 'IN_PROGRESS' ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest' : ''}`}
                  iconClassName="text-[28px]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-label-xs text-label-xs text-primary font-bold shrink-0">{creator.name}</span>
                    {showDday && (
                      <>
                        <span className="text-outline text-[10px] shrink-0">·</span>
                        <span className="font-label-xs text-label-xs text-on-surface-variant truncate">{dday}</span>
                      </>
                    )}
                  </div>
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {event?.title ?? `이벤트 #${entry.eventId}`}
                  </p>
                </div>
                {statusMeta && <StatusPill label={statusMeta.label} tone={statusMeta.tone} className="shrink-0" />}
              </div>

              <div className="flex items-center justify-between pt-space-sm border-t border-surface-container">
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  <strong className="text-primary font-bold">{formatNumber(entry.ticketCount)}장</strong> 사용
                  <span className="text-outline"> · {entry.entryCount}회 응모</span>
                </span>
                {entry.published ? (
                  entry.winUnknown ? (
                    <span className="font-label-xs text-label-xs text-on-surface-variant">당첨 확인 불가</span>
                  ) : won ? (
                    <span className="flex items-center gap-1 font-label-xs text-label-xs text-primary font-bold">
                      <MaterialIcon name="celebration" filled className="text-[16px]" />
                      당첨! {entry.myWin.prizeDisplayName ?? ''}
                    </span>
                  ) : (
                    <span className="font-label-xs text-label-xs text-on-surface-variant">아쉽게 미당첨</span>
                  )
                ) : (
                  <span className="font-label-xs text-label-xs text-on-surface-variant">발표 대기</span>
                )}
              </div>
            </Link>
          )
        })}
        {filteredEntries.length > ENTRY_PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setShownCount((count) => (hiddenCount > 0 ? count + ENTRY_PAGE_SIZE : ENTRY_PAGE_SIZE))}
            aria-expanded={hiddenCount === 0}
            className="flex items-center justify-center gap-1 py-space-sm rounded-xl bg-surface-container-lowest shadow-card font-label-md text-label-md text-primary font-semibold md:col-span-2"
          >
            {hiddenCount > 0 ? `더보기 (${formatNumber(hiddenCount)}개)` : '접기'}
            <MaterialIcon name={hiddenCount > 0 ? 'expand_more' : 'expand_less'} className="text-[18px]" />
          </button>
        )}
      </div>
    </div>
  )
}
