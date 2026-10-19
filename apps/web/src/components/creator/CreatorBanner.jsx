import { useState } from 'react'
import PersonIcon from '../ui/PersonIcon.jsx'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

/** 배너가 없거나 로드에 실패하면 다른 이미지로 대체하지 않고 사람 아이콘을 표시한다. */
export default function CreatorBanner({ src }) {
  const bannerSrc = toSafeImageUrl(src)

  return <CreatorBannerImages key={bannerSrc} bannerSrc={bannerSrc} />
}

function CreatorBannerImages({ bannerSrc }) {
  const [failedSrcs, setFailedSrcs] = useState(() => new Set())
  const imageSrc = bannerSrc && !failedSrcs.has(bannerSrc) ? bannerSrc : null

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-surface-container text-on-surface-variant">
      <PersonIcon className="h-12 w-12" />
      {imageSrc && (
        <img className="absolute inset-0 h-full w-full object-cover" src={imageSrc} alt="" loading="lazy" decoding="async" onError={() => setFailedSrcs((current) => new Set(current).add(imageSrc))} />
      )}
    </div>
  )
}
