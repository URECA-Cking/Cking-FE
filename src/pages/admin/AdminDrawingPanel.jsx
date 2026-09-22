import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../../components/ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getEvents } from '../../api/events.js'
import {
  getClosingStatus,
  getDrawing,
  getDrawingResult,
  getDrawingVerificationHistory,
  getEventSnapshot,
  publishDrawing,
  runInitialDrawing,
  verifyDrawing,
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
  const [verificationHistory, setVerificationHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const { data, loading, error, reload } = useAsync(
    () => getEvents({ status: 'CLOSED', size: 50 }),
    [],
    { fallbackMessage: '마감된 이벤트를 불러오지 못했습니다.' },
  )

  const events = data?.items ?? []

  async function inspect(event) {
    setSelected(event)
    setDetail(null)
    setVerificationHistory([])
    setHistoryOpen(false)
    setBusy(true)
    try {
      const canQueryClosingStatus = event.status === 'CLOSING' || event.status === 'CLOSED'
      const hasCompletedInitialDrawing = event.status === 'DRAW_COMPLETED' || event.status === 'PUBLISHED'
      const [closing, snapshot, restored] = await Promise.all([
        canQueryClosingStatus
          ? getClosingStatus(event.eventId, userId).catch((err) => ({ error: describeError(err) }))
          : Promise.resolve({ status: event.status }),
        getEventSnapshot(event.eventId, userId).catch((err) => ({ error: describeError(err) })),
        hasCompletedInitialDrawing ? restoreInitialDrawing(event.eventId) : Promise.resolve(null),
      ])
      setDetail({
        closing,
        snapshot,
        drawing: restored?.drawing ?? null,
        result: restored?.result ?? null,
        verification: null,
        drawingError: restored?.error,
      })
    } finally {
      setBusy(false)
    }
  }

  async function restoreInitialDrawing(eventId) {
    try {
      // 완료된 INITIAL Drawing 요청은 BE에서 기존 Drawing을 반환하는 멱등 경로다.
      const initial = await runInitialDrawing(eventId, userId)
      const [drawing, result] = await Promise.all([
        getDrawing(initial.drawingId, userId).catch(() => initial),
        getDrawingResult(initial.drawingId, userId).catch(() => null),
      ])
      return { drawing, result }
    } catch (err) {
      return { error: describeError(err, '완료된 추첨 정보를 불러오지 못했어요.') }
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
      setDetail((prev) => ({ ...prev, drawing: meta ?? drawing, result, verification: null }))
    } catch (err) {
      showToast(describeError(err, '추첨 실행에 실패했습니다.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function refreshDrawing(drawingId, { includeResult = true } = {}) {
    const [drawing, result] = await Promise.all([
      getDrawing(drawingId, userId),
      includeResult ? getDrawingResult(drawingId, userId).catch(() => null) : Promise.resolve(null),
    ])
    setDetail((prev) => ({ ...prev, drawing, result: result ?? prev?.result }))
    return drawing
  }

  async function publish() {
    if (!detail?.drawing) return
    setBusy(true)
    try {
      await publishDrawing(detail.drawing.drawingId, userId)
      showToast('추첨 결과를 공개했어요.')
      await refreshDrawing(detail.drawing.drawingId)
    } catch (err) {
      showToast(describeError(err, '추첨 결과를 공개하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (!detail?.drawing) return
    setBusy(true)
    try {
      const verification = await verifyDrawing(detail.drawing.drawingId, userId)
      setDetail((prev) => ({ ...prev, verification }))
      setVerificationHistory((current) => [verification, ...current.filter((item) => item.verificationId !== verification.verificationId)])
      showToast(verification.status === 'VERIFIED' ? '추첨 검증을 완료했어요.' : '검증 결과에서 확인이 필요한 항목이 있어요.')
    } catch (err) {
      showToast(describeError(err, '추첨 검증을 실행하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function toggleVerificationHistory() {
    if (!detail?.drawing) return
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }

    setBusy(true)
    try {
      const page = await getDrawingVerificationHistory(detail.drawing.drawingId, userId, { size: 20 })
      setVerificationHistory(page?.items ?? [])
      setHistoryOpen(true)
    } catch (err) {
      showToast(describeError(err, '검증 이력을 불러오지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
        마감된 이벤트를 선택하면 마감 상태와 공식 스냅샷을 확인하고, 초기 추첨부터 재시도·검증·결과 공개까지 처리할 수 있어요.
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

              {detail.drawingError && <ErrorBlock message={detail.drawingError} onRetry={() => inspect(selected)} />}

              {selected.status === 'CLOSED' && !detail.drawing && (
                <button
                  type="button"
                  onClick={executeDrawing}
                  className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
                >
                  초기 추첨 실행
                </button>
              )}

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

              {detail.drawing && (
                <div className="grid grid-cols-2 gap-2">
                  {detail.drawing.status === 'COMPLETED' && (
                    <>
                      {detail.drawing.visibility !== 'PUBLIC' && (
                        <button
                          type="button"
                          onClick={publish}
                          className="h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all"
                        >
                          <MaterialIcon name="public" className="text-[17px] mr-1" />
                          결과 공개
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={verify}
                        className="h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all"
                      >
                        <MaterialIcon name="verified" className="text-[17px] mr-1" />
                        추첨 검증
                      </button>
                      <button
                        type="button"
                        onClick={toggleVerificationHistory}
                        className="h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all"
                      >
                        <MaterialIcon name="history" className="text-[17px] mr-1" />
                        검증 이력
                        <MaterialIcon name={historyOpen ? 'expand_less' : 'expand_more'} className="text-[17px] ml-0.5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {detail.verification && <VerificationCard verification={detail.verification} title="최근 검증 결과" />}

              {historyOpen && (
                <div className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">검증 이력</span>
                  {verificationHistory.length === 0 ? (
                    <p className="font-label-sm text-label-sm text-on-surface-variant">아직 검증 이력이 없어요.</p>
                  ) : (
                    verificationHistory.map((verification) => (
                      <VerificationCard key={verification.verificationId} verification={verification} />
                    ))
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
                      <Link
                        key={winner.winnerId}
                        to={`/admin/winners/${winner.winnerId}`}
                        state={{ winner }}
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
                        <MaterialIcon name="chevron_right" className="text-outline text-[18px] shrink-0" />
                      </Link>
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

function VerificationCard({ verification, title }) {
  const verified = verification.status === 'VERIFIED'
  return (
    <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <MaterialIcon name={verified ? 'verified' : 'warning'} className={`text-[18px] ${verified ? 'text-secondary' : 'text-error'}`} />
        <span className="font-label-sm text-label-sm text-on-surface font-semibold flex-1">{title ?? verification.status}</span>
        <StatusPill
          label={verified ? '검증 완료' : '확인 필요'}
          tone={verified ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'}
        />
      </div>
      <p className="font-label-xs text-label-xs text-on-surface-variant">
        예상 {formatNumber(verification.expectedWinnerCount)}명 · 실제 {formatNumber(verification.actualWinnerCount)}명 · {formatDateTime(verification.verifiedAt)}
      </p>
      {verification.failureMessage && <p className="font-label-xs text-label-xs text-error">{verification.failureMessage}</p>}
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
