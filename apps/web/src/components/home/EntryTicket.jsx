import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { useEntryStatus } from '../../hooks/useEntryStatus.js'
import { useCreatorProfile } from '../../hooks/useCreatorProfile.js'
import { formatDday, formatNumber } from '../../utils/format.js'

/**
 * 홈 응모 목록의 티켓 한 장. 크리에이터 사진(88 × 88) | 절취선 | 정보 순이고, 정보는 D-day·크리에이터, 제목, 보유 응모권 세 줄뿐이다.
 * 카드 전체가 상세로 가는 링크이고, 응모 가능 여부의 최종 판정은 서버(응모 결과 코드)가 한다.
 */
export default function EntryTicket({ event, ticketsOwned, applied = null, featured = false }) {
  const creator = useCreatorProfile(event.creatorId)
  // 참여자 수는 표시용이라 조회 중이거나 실패하면 그 문구만 뺀다(응모 버튼과 무관). 홈에 보이는 동안 주기적으로 갱신한다.
  const { status } = useEntryStatus(event.eventId, { enabled: true, live: event.displayStatus === 'IN_PROGRESS' })
  const participants = status?.participantCount

  return (
    <Link
      to={`/events/${event.eventId}`}
      className={`flex h-[5.5rem] overflow-hidden rounded-2xl border bg-surface-container active:opacity-80 transition-opacity ${
        featured ? 'border-primary/40' : 'border-on-surface/10'
      }`}
    >
      <ProfilePhoto src={creator.avatar} className="h-[5.5rem] w-[5.5rem] flex-shrink-0" iconClassName="text-[40px]" loading="lazy" decoding="async" />
      <span className="relative w-0 flex-shrink-0 border-l-2 border-dashed border-surface">
        <span className="absolute -top-2 -left-[9px] h-4 w-4 rounded-full bg-surface" />
        <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-surface" />
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant font-normal">
            <span className={`shrink-0 rounded-full px-2 font-semibold ${featured ? 'bg-primary text-on-primary' : 'bg-primary/15 text-primary'}`}>{formatDday(event.endAt)}</span>
            <span className="truncate">{creator.name}</span>
          </p>
          <p className="font-label-md text-label-md text-on-surface line-clamp-1">{event.title}</p>
          {(typeof ticketsOwned === 'number' || typeof participants === 'number') && (
            <p className="font-label-sm text-label-sm text-on-surface-variant font-normal line-clamp-1">
              {typeof ticketsOwned === 'number' && `보유 ${formatNumber(ticketsOwned)}장`}
              {typeof ticketsOwned === 'number' && typeof participants === 'number' && ' · '}
              {typeof participants === 'number' && `${formatNumber(participants)}명 참여`}
            </p>
          )}
        </div>
        {/* 같은 이벤트에 여러 번 응모할 수 있어 응모한 뒤에도 눌리고, 칩만 채움에서 윤곽으로 바뀐다.
        // applied가 null이면 응모 여부를 아직 모르는 상태(조회 중·실패)라 중립 칩으로 보여준다. */}
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-label-sm text-label-sm ${
            applied === null
              ? 'bg-surface-container-high text-on-surface-variant'
              : applied ? 'border border-primary/60 text-primary' : 'bg-primary text-on-primary'
          }`}
        >
          {applied === null ? '확인 중' : applied ? '응모 완료' : '응모'}
        </span>
      </div>
    </Link>
  )
}
