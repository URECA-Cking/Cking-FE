import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDeadStreams, replayDeadStream } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime } from '../../utils/format.js'

const STATUS_META = {
  UNRESOLVED: { label: '처리 대기', tone: 'bg-error-container text-on-error-container', icon: 'priority_high' },
  RESOLVED: { label: '처리 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
}

const STREAM_META = {
  EARN: { label: '응모권 적립', icon: 'add_circle', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  SPEND: { label: '응모권 사용', icon: 'remove_circle', tone: 'bg-berry-tint text-primary' },
}

export default function AdminDeadStreams() {
  const navigate = useNavigate()
  const { userId } = useUser()
  const showToast = useToast()
  const [status, setStatus] = useState('UNRESOLVED')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState(null)

  const { data, loading, error, reload } = useAsync(
    () => getDeadStreams(userId, { status, page, size: 20 }),
    [userId, status, page],
    { fallbackMessage: '데드 스트림 목록을 불러오지 못했어요.' },
  )

  const items = data?.items ?? []

  function selectStatus(nextStatus) {
    setStatus(nextStatus)
    setPage(0)
  }

  async function replay(item) {
    if (!window.confirm(`데드 메시지 #${item.id}을 다시 처리할까요? 원인을 해결한 뒤 실행해주세요.`)) return
    setBusyId(item.id)
    try {
      await replayDeadStream(item.id, userId)
      showToast(`데드 메시지 #${item.id}을 다시 처리했어요.`)
      await reload()
    } catch (replayError) {
      showToast(describeError(replayError, '데드 메시지를 다시 처리하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-8">
      <BackHeader title="데드 스트림 관리" onBack={() => navigate('/admin')} />

      <main className="pt-16 px-margin flex flex-col gap-space-md md:mx-auto md:w-full md:max-w-6xl md:px-8">
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating relative overflow-hidden">
          <MaterialIcon name="warning" filled className="absolute -right-2 -bottom-4 text-[112px] text-primary-fixed/15" />
          <div className="relative flex items-start gap-space-sm">
            <div className="w-11 h-11 rounded-xl bg-primary-fixed/20 flex items-center justify-center shrink-0">
              <MaterialIcon name="emergency" filled className="text-primary-fixed text-[24px]" />
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Dead stream</p>
              <h2 className="font-title-lg text-title-lg font-bold mt-1">처리 실패 메시지 관리</h2>
              <p className="font-body-sm text-body-sm text-primary-fixed mt-1">원인을 확인한 뒤 메시지를 안전하게 다시 처리하세요.</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-container-low">
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectStatus(value)}
              className={`h-10 rounded-lg font-label-sm text-label-sm font-semibold transition-colors ${
                status === value ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {loading && <LoadingBlock label="데드 스트림 목록을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && (
          <EmptyBlock icon={status === 'UNRESOLVED' ? 'done_all' : 'history'} message={status === 'UNRESOLVED' ? '처리할 데드 메시지가 없어요.' : '처리 완료 이력이 없어요.'} />
        )}
        {!loading && !error && items.length > 0 && (
          <section className="flex flex-col gap-space-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant">총 {data.totalElements}건 · 오래된 메시지부터 표시돼요.</p>
            <div className="grid grid-cols-1 gap-space-sm xl:grid-cols-2">
              {items.map((item) => <DeadStreamCard key={item.id} item={item} busy={busyId === item.id} onReplay={replay} />)}
            </div>
          </section>
        )}

        {!loading && !error && data && data.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)} className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface font-label-sm text-label-sm font-semibold disabled:opacity-40">이전</button>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{page + 1} / {data.totalPages}</span>
            <button type="button" disabled={!data.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface font-label-sm text-label-sm font-semibold disabled:opacity-40">다음</button>
          </div>
        )}
      </main>
    </div>
  )
}

function DeadStreamCard({ item, busy, onReplay }) {
  const statusMeta = STATUS_META[item.resolutionStatus] ?? STATUS_META.UNRESOLVED
  const streamMeta = STREAM_META[item.streamType] ?? { label: item.streamType, icon: 'stream', tone: 'bg-surface-container-high text-on-surface-variant' }
  const isUnresolved = item.resolutionStatus === 'UNRESOLVED'

  return (
    <article className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name={streamMeta.icon} className="text-primary text-[19px]" />
            <p className="font-title-md text-title-md text-on-surface font-bold">{streamMeta.label}</p>
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant mt-1">메시지 #{item.id} · 재시도 {item.retryCount}회</p>
        </div>
        <StatusPill label={statusMeta.label} tone={statusMeta.tone} icon={statusMeta.icon} className="shrink-0" />
      </div>

      <div className="p-space-sm rounded-xl bg-error-container/35">
        <p className="font-label-xs text-label-xs text-on-error-container font-semibold">실패 원인</p>
        <p className="font-body-sm text-body-sm text-on-error-container mt-1">{item.failureReason}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 font-label-xs text-label-xs text-on-surface-variant">
        <Info label="이벤트" value={item.eventId ? `#${item.eventId}` : '해당 없음'} />
        <Info label="사용자" value={item.memberId ? `#${item.memberId}` : '해당 없음'} />
        <Info label="최종 실패" value={formatDateTime(item.lastFailedAt)} />
        <Info label="생성" value={formatDateTime(item.createdAt)} />
      </div>

      {item.resolvedAt && <p className="font-label-xs text-label-xs text-on-surface-variant">처리 완료: 관리자 #{item.resolvedBy} · {formatDateTime(item.resolvedAt)}</p>}
      {isUnresolved && (
        <button type="button" disabled={busy} onClick={() => onReplay(item)} className="w-full h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
          <MaterialIcon name="replay" className="text-[18px] mr-1" />
          {busy ? '다시 처리하는 중...' : '다시 처리'}
        </button>
      )}
    </article>
  )
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <p>{label}</p>
      <p className="font-label-sm text-label-sm text-on-surface font-semibold truncate mt-0.5">{value}</p>
    </div>
  )
}
