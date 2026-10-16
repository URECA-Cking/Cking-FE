import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { spacePath } from '../../api/creatorSpace.js'

/** 아바타·이름·소개와 관심 버튼이 있는 크리에이터 한 줄. rowRef·onOpen은 추천 노출·클릭 수집용이다. */
export default function CreatorRow({ creator, followed, disabled, onToggle, rowRef, onOpen }) {
  return (
    <div
      ref={rowRef}
      className="w-full p-3 rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between gap-3"
    >
      <Link to={spacePath(creator.handle)} onClick={onOpen} className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
          <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{creator.name}</span>
          <span className="font-body-sm text-body-sm text-outline line-clamp-1">{creator.bio}</span>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onToggle(creator)}
        disabled={disabled}
        className={`flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
          followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
        }`}
      >
        <MaterialIcon name={followed ? 'done' : 'add'} className="text-[16px]" />
        <span>{followed ? '완료' : '관심'}</span>
      </button>
    </div>
  )
}
