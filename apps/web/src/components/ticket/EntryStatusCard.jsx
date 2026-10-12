import MaterialIcon from '../ui/MaterialIcon.jsx'
import { formatNumber } from '../../utils/format.js'

function Stat({ label, value, unit, accent = false }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-2">
      <span className="font-label-xs text-label-xs text-on-surface-variant whitespace-nowrap">{label}</span>
      <span className="flex items-baseline gap-0.5 whitespace-nowrap">
        <span className={`font-metric-display text-metric-display ${accent ? 'text-primary' : 'text-on-surface'}`}>
          {formatNumber(value)}
        </span>
        <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">{unit}</span>
      </span>
    </div>
  )
}

/**
 * 이벤트 상세의 응모 현황 카드. 표시용 값이라 응모 가능 여부 판단에는 쓰지 않는다.
 * status가 없으면(첫 조회 중) 같은 높이의 자리표시만 그려 화면이 밀리지 않게 하고, 실패하면 호출하는 쪽이 그리지 않는다.
 */
export default function EntryStatusCard({ status }) {
  const live = status?.realtime === true

  return (
    <section aria-label="응모 현황" className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MaterialIcon name="insights" className="text-primary text-[20px]" />
          <h3 className="font-label-md text-label-md font-bold text-on-surface">응모 현황</h3>
        </div>
        {status && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-xs text-label-xs font-semibold ${
              live ? 'bg-berry-tint text-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {live && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            {live ? '실시간' : '집계'}
          </span>
        )}
      </div>
      {status ? (
        <div className="flex divide-x divide-outline-variant/40">
          <Stat label="참여자" value={status.participantCount} unit="명" />
          <Stat label="누적 응모권" value={status.totalTicketCount} unit="장" />
          <Stat label="내가 응모한" value={status.myTicketCount} unit="장" accent />
        </div>
      ) : (
        <div className="h-[3.25rem] rounded-xl bg-surface-container animate-pulse" aria-hidden="true" />
      )}
    </section>
  )
}
