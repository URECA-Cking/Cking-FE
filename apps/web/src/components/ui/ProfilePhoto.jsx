import { useState } from 'react'
import PersonIcon from './PersonIcon.jsx'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

/** 회원·크리에이터 사진을 표시하고 URL이 없거나 로드에 실패하면 사람 아이콘으로 대체한다. */
export default function ProfilePhoto({ src, className = '', iconClassName = 'text-[20px]', loading, decoding }) {
  const safeSrc = toSafeImageUrl(src)

  return (
    <span className={`relative flex items-center justify-center overflow-hidden rounded-full bg-surface-container text-on-surface-variant ${className}`}>
      <PersonIcon className={`h-[1em] w-[1em] ${iconClassName}`} />
      {safeSrc && <ProfileImage key={safeSrc} src={safeSrc} loading={loading} decoding={decoding} />}
    </span>
  )
}

function ProfileImage({ src, loading, decoding }) {
  const [failed, setFailed] = useState(false)
  return failed ? null : (
    <img
      className="absolute inset-0 h-full w-full object-cover"
      src={src}
      alt=""
      loading={loading}
      decoding={decoding}
      onError={() => setFailed(true)}
    />
  )
}
