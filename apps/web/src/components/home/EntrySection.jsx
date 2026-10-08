import EntryTicket from './EntryTicket.jsx'
import SectionTitle from './SectionTitle.jsx'

/**
 * 응모할 수 있는 이벤트를 마감 임박순 티켓으로. 응모 가능 여부의 최종 판정은 서버(응모 결과 코드)가 하고,
 * 여기서는 BE가 내려준 displayStatus로 목록을 고르기만 한다.
 */
export default function EntrySection({ events, balanceByCreator, appliedIds }) {
  return (
    <section className="mt-6 px-margin">
      <SectionTitle title="응모" subtitle="마감 임박순" to="/explore" />
      {events.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">지금 응모할 수 있는 이벤트가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map((event, index) => (
            <EntryTicket
              featured={index === 0}
              key={event.eventId}
              event={event}
              ticketsOwned={balanceByCreator.get(event.creatorId)}
              applied={appliedIds.has(event.eventId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
