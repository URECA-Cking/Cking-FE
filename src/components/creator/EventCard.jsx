import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { getCreatorProfile, getEventBanner } from '../../data/creatorProfiles.js'
import { formatDday, formatEventDate, formatNumber, totalPrizeQuantity } from '../../utils/format.js'
import { displayStatusMeta } from '../../utils/eventStatus.js'

/**
 * 이벤트(래플) 요약 카드. 백엔드 EventSummary( eventId, creatorId, title, startAt,
 * endAt, status, displayStatus, winnerCount, drawMethod, prizes )를 그대로 받는다.
 *
 * 응모 누적 건수는 공개 API가 제공하지 않아, 대신 실제 값이 있는 당첨 인원과
 * 상품 등급 구성을 보여준다.
 */
export default function EventCard({ event, ticketsOwned, showCreatorTag = false, variant = 'carousel' }) {
  const navigate = useNavigate()
  const creator = getCreatorProfile(event.creatorId)
  const status = displayStatusMeta(event.displayStatus)
  const closed = event.displayStatus === 'CLOSED'
  const dday = formatDday(event.endAt, { closed })
  const urgent = !closed && (dday === 'D-DAY' || dday === 'D-1')
  const prizeCount = totalPrizeQuantity(event.prizes)

  const cta = closed
    ? event.status === 'PUBLISHED'
      ? { label: '당첨 결과 보기', icon: 'emoji_events' }
      : { label: '결과 준비 중', icon: 'hourglass_top' }
    : event.displayStatus === 'UPCOMING'
      ? { label: '오픈 예정 보기', icon: 'schedule' }
      : { label: '응모하기', icon: 'touch_app' }

  const open = () => navigate(`/events/${event.eventId}`)

  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card flex flex-col group ${
        variant === 'carousel' ? 'snap-center min-w-[270px] max-w-[280px] flex-shrink-0' : 'w-full'
      }`}
    >
      <button type="button" onClick={open} className="text-left">
        <div className="relative h-36 w-full overflow-hidden bg-surface-container-high">
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={getEventBanner(event.eventId)}
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {showCreatorTag && (
            <div className="absolute top-2.5 left-2.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="font-label-xs text-label-xs text-on-surface font-bold">{creator.name}</span>
              <MaterialIcon name="verified" filled className="text-primary text-[14px]" />
            </div>
          )}

          <div
            className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm font-label-xs text-label-xs ${
              urgent ? 'bg-error text-on-error animate-pulse' : status.tone
            }`}
          >
            <MaterialIcon name={urgent ? 'alarm' : status.icon} className="text-[12px]" />
            <span className="font-bold">{closed ? status.label : dday || status.label}</span>
          </div>

          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
            <span className="font-label-sm text-label-sm font-medium opacity-90">
              {formatNumber(event.winnerCount)}명 추첨
            </span>
            {typeof ticketsOwned === 'number' && (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full">
                <span className="text-[11px]">🎟</span>
                <span className="font-label-xs text-label-xs font-semibold">보유 {formatNumber(ticketsOwned)}장</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 flex flex-col gap-2.5">
          <div>
            <h4 className="font-title-md text-title-md text-on-surface font-bold line-clamp-1">{event.title}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
              {event.prizes?.length
                ? event.prizes.map((prize) => prize.displayName).join(' · ')
                : '상품 구성이 아직 공개되지 않았어요.'}
            </p>
          </div>

          <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
            <span className="flex items-center gap-1">
              <MaterialIcon name="event" className="text-[14px]" />
              {formatEventDate(event.endAt)} 마감
            </span>
            {prizeCount > 0 && <span>상품 {formatNumber(prizeCount)}개</span>}
          </div>
        </div>
      </button>

      <div className="px-3.5 pb-3.5">
        <button
          type="button"
          onClick={open}
          className={`w-full py-2.5 rounded-xl font-label-md text-label-md font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
            closed
              ? 'bg-surface-container text-on-surface-variant'
              : 'bg-gradient-to-r from-primary to-[#e11d48] text-on-primary'
          }`}
        >
          <span>{cta.label}</span>
          <MaterialIcon name={cta.icon} className="text-[16px]" />
        </button>
      </div>
    </div>
  )
}
