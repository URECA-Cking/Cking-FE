import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

/** Raffle / event summary card used in horizontal carousels (Home, Creator Space). */
export default function EventCard({ event, ticketsOwned, showCreatorTag = false }) {
  const navigate = useNavigate()
  const ratio = Math.min(100, Math.round((event.applied / event.quota) * 100))
  const isUrgent = event.dDay === 'D-1' || event.dDay === 'D-0'

  return (
    <div className="snap-center min-w-[270px] max-w-[280px] flex-shrink-0 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-md flex flex-col group">
      <button
        type="button"
        onClick={() => navigate(`/events/${event.id}`)}
        className="text-left"
      >
        <div className="relative h-36 w-full overflow-hidden bg-surface-container-high">
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={event.banner}
            alt={event.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {showCreatorTag && (
            <div className="absolute top-2.5 left-2.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="font-label-xs text-label-xs text-on-surface font-bold">{event.creatorName}</span>
              <MaterialIcon name="verified" filled className="text-primary text-[14px]" />
            </div>
          )}
          <div
            className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm font-label-xs text-label-xs ${
              isUrgent ? 'bg-error text-on-error animate-pulse' : 'bg-tertiary-fixed text-on-tertiary-fixed'
            }`}
          >
            <MaterialIcon name={isUrgent ? 'alarm' : 'schedule'} className="text-[12px]" />
            <span className="font-bold">{event.dDay}</span>
          </div>
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
            <span className="font-label-sm text-label-sm font-medium opacity-90">{event.quotaLabel}</span>
            {typeof ticketsOwned === 'number' && (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full">
                <span className="text-[11px]">🎟</span>
                <span className="font-label-xs text-label-xs font-semibold">보유 {ticketsOwned}장</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-3.5 flex flex-col gap-2.5">
          <div>
            <h4 className="font-title-md text-title-md text-on-surface font-bold line-clamp-1">{event.title}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
              {event.description}
            </p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: `${ratio}%` }} />
          </div>
          <div className="flex justify-between items-center text-outline font-label-xs text-label-xs">
            <span>실시간 누적 응모 {ratio}%</span>
            <span>
              {event.applied.toLocaleString()} / {event.quota.toLocaleString()}명
            </span>
          </div>
        </div>
      </button>
      <div className="px-3.5 pb-3.5">
        <button
          type="button"
          onClick={() => navigate(`/events/${event.id}`)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-[#e11d48] text-on-primary font-label-md text-label-md font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <span>응모하기</span>
          <MaterialIcon name="touch_app" className="text-[16px]" />
        </button>
      </div>
    </div>
  )
}
