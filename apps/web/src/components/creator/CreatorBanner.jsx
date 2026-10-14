import { useState } from 'react'
import PersonIcon from '../ui/PersonIcon.jsx'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

/** 배너가 없거나 실패하면 프로필 사진, 둘 다 실패하면 사람 아이콘을 표시한다. */
export default function CreatorBanner({ src, profileSrc }) {
  const bannerSrc = toSafeImageUrl(src)
  const avatarSrc = toSafeImageUrl(profileSrc)

  return <CreatorBannerImages key={JSON.stringify([bannerSrc, avatarSrc])} bannerSrc={bannerSrc} avatarSrc={avatarSrc} />
}

function CreatorBannerImages({ bannerSrc, avatarSrc }) {
  const [failedSrcs, setFailedSrcs] = useState(() => new Set())
  const imageSrc = [bannerSrc, avatarSrc].find((candidate) => candidate && !failedSrcs.has(candidate))

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-surface-container text-on-surface-variant">
      <PersonIcon className="h-12 w-12" />
      {imageSrc && (
        <img className="absolute inset-0 h-full w-full object-cover" src={imageSrc} alt="" loading="lazy" decoding="async" onError={() => setFailedSrcs((current) => new Set(current).add(imageSrc))} />
      )}
    </div>
  )
}
