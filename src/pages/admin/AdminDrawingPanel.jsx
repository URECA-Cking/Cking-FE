import { useState } from 'react'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../../components/ui/States.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getEvents } from '../../api/events.js'
import {
  getClosingStatus,
  getDrawing,
  getDrawingResult,
  getEventSnapshot,
  runInitialDrawing,
} from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { getCreatorProfile } from '../../data/creatorProfiles.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'
import { eventStatusMeta } from '../../utils/eventStatus.js'

/**
 * 관리자 추첨 운영 패널.
 *
 * 마감된 이벤트를 골라 마감 상태 / 공식 스냅샷을 확인하고 초기 추첨을 실행한 뒤
 * 추첨 메타데이터와 당첨자 결과를 조회한다.
 */
export default function AdminDrawingPanel() {
  const showToast = useToast()
  const { userId } = useUser()
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload } = useAsync(
    () => getEvents({ status: 'CLOSED', size: 50 }),
    [],
    { fallbackMessage: '마감된 이벤트를 불러오지 못했습니다.' },
  )

  const events = data?.items ?? []

  async function inspect(event) {
    setSelected(event)
    setDetail(null)
    setBusy(true)
    try {
      const [closing, snapshot] = await Promise.all([
        getClosingStatus(event.eventId, userId).catch((err) => ({ error: describeError(err) })),
        getEventSnapshot(event.eventId, userId).catch((err) => ({ error: describeError(err) })),
      ])
      setDetail({ closing, snapshot, drawing: null, result: null })
    } finally {
      setBusy(false)
    }
  }

  async function executeDrawing() {
    if (!selected) return
    setBusy(true)
    try {
      const drawing = await runInitialDrawing(selected.eventId, userId)
      showToast(`추첨을 실행했어요. (drawingId ${drawing.drawingId}, ${drawing.status})`)
      const [meta, result] = await Promise.all([
        getDrawing(drawing.drawingId, userId).catch(() => null),
        getDrawingResult(drawing.drawingId, userId).catch(() => null),
      ])
      setDetail((prev) => ({ ...prev, drawing: meta ?? drawing, result }))
    } catch (err) {
      showToast(describeError(err, '추첨 실행에 실패했습니다.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
        마감된 이벤트를 선택하면 마감 상태와 공식 스냅샷을 확인하고 초기 추첨을 실행할 수 있어요. 결과 공개(PUBLISHED
        전환)는 백엔드 내부 서비스에서 처리되어 외부 API가 없습니다.
      </p>

      {loading && <LoadingBlock label="마감된 이벤트를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && events.length === 0 && (
        <EmptyBlock icon="event_busy" message="마감된 이벤트가 아직 없어요." />
      )}

      <div className="flex flex-col gap-2">
        {events.map((event) => {
          const meta = eventStatusMeta(event.status)
          const active = selected?.eventId === event.eventId
          return (
            <button
              key={event.eventId}
              type="button"
              onClick={() => inspect(event)}
              className={`p-space-sm rounded-xl flex items-center justify-between gap-space-sm text-left transition-all active:scale-[0.99] ${
                active ? 'bg-berry-tint border border-primary' : 'bg-surface-container-lowest shadow-card'
              }`}
            >
              <div className="min-w-0">
                <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{event.title}</p>
                <p className="font-label-xs text-label-xs text-on-surface-variant">
                  #{event.eventId} · {getCreatorProfile(event.creatorId).name} · 당첨{' '}
                  {formatNumber(event.winnerCount)}명
                </p>
              </div>
              <StatusPill label={meta.label} tone={meta.tone} className="shrink-0" />
            </button>
          )
        })}
      </div>

      {selected && (
        <section className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-title-md text-title-md text-on-surface font-bold truncate">{selected.title}</h3>
            <span className="font-label-xs text-label-xs text-outline">#{selected.eventId}</span>
          </div>

          {busy && <LoadingBlock label="처리 중..." />}

          {!busy && detail && (
            <>
              <InfoRow
                icon="lock_clock"
                label="마감 상태"
                value={detail.closing?.error ? detail.closing.error : (detail.closing?.status ?? '-')}
                tone={detail.closing?.error ? 'text-error' : 'text-on-surface'}
              />

              {detail.snapshot?.error ? (
                <InfoRow icon="photo_camera" label="공식 스냅샷" value={detail.snapshot.error} tone="text-error" />
              ) : (
                <div className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="photo_camera" className="text-primary text-[18px]" />
                    <span className="font-label-md text-label-md text-on-surface font-semibold">공식 스냅샷</span>
                  </div>
                  <p className="font-label-xs text-label-xs text-on-surface-variant">
                    후보 {formatNumber(detail.snapshot?.candidateCount)}명 · 누적 응모권{' '}
                    {formatNumber(detail.snapshot?.totalTicketCount)}장 · 당첨{' '}
                    {formatNumber(detail.snapshot?.winnerCount)}명
                  </p>
                  <p className="font-label-xs text-label-xs text-outline break-all">
                    hash {detail.snapshot?.snapshotHash}
                  </p>
                  <p className="font-label-xs text-label-xs text-outline">
                    {formatDateTime(detail.snapshot?.createdAt)} 생성 · {detail.snapshot?.algorithmVersion}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={executeDrawing}
                className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
              >
                초기 추첨 실행
              </button>

              {detail.drawing && (
                <div className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="casino" className="text-primary text-[18px]" />
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      추첨 #{detail.drawing.drawingId}
                    </span>
                    <StatusPill
                      label={detail.drawing.status}
                      tone="bg-secondary-fixed text-on-secondary-fixed"
                      className="ml-auto"
                    />
                  </div>
                  <p className="font-label-xs text-label-xs text-on-surface-variant">
                    {detail.drawing.drawType} · {detail.drawing.drawNo}회차 · 당첨{' '}
                    {formatNumber(detail.drawing.winnerCount)}명 · {detail.drawing.visibility ?? ''}
                  </p>
                  {detail.drawing.algorithmVersion && (
                    <p className="font-label-xs text-label-xs text-outline">
                      {detail.drawing.algorithmVersion} / {detail.drawing.prizeAlgorithmVersion}
                    </p>
                  )}
                </div>
              )}

              {detail.result?.winners?.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    당첨자 {detail.result.winners.length}명
                  </span>
                  <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto no-scrollbar">
                    {detail.result.winners.map((winner) => (
                      <li
                        key={winner.winnerId}
                        className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center gap-space-sm"
                      >
                        <span className="w-7 h-7 rounded-full bg-berry-tint text-primary flex items-center justify-center font-label-xs text-label-xs font-bold shrink-0">
                          {winner.rankInDrawing}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
                            {winner.name} (#{winner.userId})
                          </p>
                          <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
                            {winner.prizeDisplayName ?? '상품 미지정'} · 사용 응모권{' '}
                            {formatNumber(winner.appliedTicketCount)}장
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value, tone = 'text-on-surface' }) {
  return (
    <div className="flex items-center gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest">
      <MaterialIcon name={icon} className="text-primary text-[18px] shrink-0" />
      <span className="font-label-md text-label-md text-on-surface font-semibold">{label}</span>
      <span className={`ml-auto font-label-sm text-label-sm text-right ${tone}`}>{value}</span>
    </div>
  )
}
