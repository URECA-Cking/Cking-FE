import CreatorVerifiedBadge from '../ui/CreatorVerifiedBadge.jsx'
import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { spacePath } from '../../api/creatorSpace.js'

/**
 * 아바타·이름·소개와 관심 버튼이 있는 크리에이터 한 줄. rowRef·onOpen은 추천 노출·클릭 수집용이다.
 *
 * variant="card"는 카드 배경에 소개문을 보여주고, variant="flat"은 배경 없이 큰 아바타와 이름, 오른쪽 테두리 버튼만 둔다.
 * flat에서는 소개문 자리에 meta(예: 진행 중 뱃지·응모권)를 넣고, highlight이면 아바타에 강조 링을 두른다.
 * trackBalance는 화면에 보이는 행만 응모권 잔액을 조회하도록 표시한다.
 */
export default function CreatorRow({ creator, followed, disabled, onToggle, rowRef, onOpen, variant = 'card', meta, highlight = false, trackBalance = false }) {
  const flat = variant === 'flat'
  return (
    <div
      ref={rowRef}
      data-balance-creator-id={trackBalance ? creator.creatorId : undefined}
      className={flat
        ? 'w-full py-2.5 flex items-center justify-between gap-3'
        : 'w-full p-3 rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between gap-3'}
    >
      <Link to={spacePath(creator.handle)} onClick={onOpen} className={'flex items-center gap-3 min-w-0'}>
        <div
          className={`rounded-full overflow-hidden flex-shrink-0 ${'w-12 h-12'} ${
            flat && highlight ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
          }`}
        >
          <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{creator.name}</span>
            <CreatorVerifiedBadge />
          </span>
          {flat
            ? meta
            : <span className="font-body-sm text-body-sm text-outline line-clamp-1">{creator.bio}</span>}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onToggle(creator)}
        disabled={disabled}
        className={flat
          ? `flex-shrink-0 h-7 px-3 rounded-lg border font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
            followed ? 'border-primary text-primary bg-berry-tint' : 'border-outline-variant text-on-surface'
          }`
          : `flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
            followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
          }`}
      >
        {flat
          ? <span>{followed ? '도킹 중' : '도킹'}</span>
          : (
            <>
              <MaterialIcon name={followed ? 'done' : 'add'} className="text-[16px]" />
              <span>{followed ? '완료' : '도킹'}</span>
            </>
          )}
      </button>
    </div>
  )
}
