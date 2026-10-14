import { useState } from 'react'
import MaterialIcon from './MaterialIcon.jsx'

/** 회원·크리에이터 사진을 표시하고 URL이 없거나 로드에 실패하면 사람 아이콘으로 대체한다. */
export default function ProfilePhoto({ src, className = '', iconClassName = 'text-[20px]', loading, decoding }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-full bg-surface-container text-on-surface-variant ${className}`}>
      {showImage ? (
        <img
          className="h-full w-full object-cover"
          src={src}
          alt=""
          loading={loading}
          decoding={decoding}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <MaterialIcon name="person" className={iconClassName} />
      )}
    </span>
  )
}
