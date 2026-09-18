import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { events } from '../data/events.js'
import { getCreatorById } from '../data/creators.js'

export default function MyEntries() {
  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-md">
      <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">내 응모 현황</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">
        지금까지 참여한 래플 응모 내역을 한눈에 확인해봐
      </p>

      <div className="flex flex-col gap-space-sm">
        {events.map((event) => {
          const creator = getCreatorById(event.creatorId)
          return (
            <div key={event.id} className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex items-center gap-space-md">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                <img className="w-full h-full object-cover" src={event.banner} alt="" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-label-xs text-label-xs text-primary font-bold">{creator?.name}</span>
                  <span className="text-outline text-[10px]">·</span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">{event.dDay}</span>
                </div>
                <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{event.title}</p>
              </div>
              <span className="font-label-xs text-label-xs px-2.5 py-1 rounded-full bg-berry-tint text-primary font-semibold shrink-0">
                발표 대기
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-space-md flex flex-col items-center gap-space-sm py-space-xl text-center text-on-surface-variant">
        <MaterialIcon name="confirmation_number" className="text-[40px] text-outline" />
        <p className="font-body-sm text-body-sm">더 많은 이벤트에 응모하고 다양한 굿즈를 받아보세요!</p>
      </div>
    </div>
  )
}
