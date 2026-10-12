import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

/** 프로필 이미지가 없거나 불러오지 못하면 사람 아이콘으로 대신한다. */
export function CreatorPhoto({ src }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <span className="w-full h-full rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
        <MaterialIcon name="person" className="text-[20px]" />
      </span>
    )
  }
  return (
    <img
      className="w-full h-full rounded-full object-cover bg-surface-container"
      src={src}
      alt=""
      onError={() => setBroken(true)}
    />
  )
}

/**
 * 홈 "소식" 가로 행의 크리에이터 항목. 최근 글이 있으면(isNew) 링 색만 바뀐다.
 * isNew는 화면 힌트일 뿐이라 부모가 계산해 넘긴다(읽음 상태를 주는 API는 없다).
 */
export default function CreatorAvatarItem({ creator, isNew = false }) {
  return (
    <Link
      to={`/creators/${creator.creatorId}`}
      aria-label={isNew ? `${creator.name}, 새 소식` : creator.name}
      className="flex flex-col items-center flex-shrink-0 w-16 group"
    >
      <span
        className={`relative block w-12 h-12 rounded-full p-0.5 border-2 group-active:scale-95 transition-transform ${
          isNew ? 'border-primary' : 'border-on-surface/10'
        }`}
      >
        {isNew && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-label-xs text-[10px] leading-4 text-on-primary">
            NEW
          </span>
        )}
        {/* 주소가 바뀌면 깨짐 상태를 새로 시작하도록 key를 준다. */}
        <CreatorPhoto key={creator.avatar} src={creator.avatar} />
      </span>
      <span className="mt-1 font-label-sm text-label-sm text-on-surface-variant font-normal truncate max-w-full">
        {creator.name}
      </span>
    </Link>
  )
}
