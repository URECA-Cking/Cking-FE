import { useState } from 'react'
import PersonIcon from './PersonIcon.jsx'

/** 회원·크리에이터 사진을 표시하고 URL이 없거나 로드에 실패하면 사람 아이콘으로 대체한다. */
export default function ProfilePhoto({ src, className = '', iconClassName = 'text-[20px]', loading, decoding }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span className={`relative flex items-center justify-center overflow-hidden rounded-full bg-surface-container text-on-surface-variant ${className}`}>
      <PersonIcon className={`h-[1em] w-[1em] ${iconClassName}`} />
      {showImage && (
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          alt=""
          loading={loading}
          decoding={decoding}
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  )
}
