import { useState } from 'react'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

/**
 * 스페이스 헤더 뒤에 깔리는 배너. 위쪽은 배너가 비치고 아래로 갈수록 화면 배경색으로 옅어져, 그 위의 글자가 일반·다크
 * 모드 모두에서 읽힌다. 배너가 없거나 로드에 실패하면 프로필 사진 같은 다른 이미지로 대체하지 않고 중립 배경만 둔다.
 */
export default function SpaceHeaderBackdrop({ src }) {
  const bannerSrc = toSafeImageUrl(src)
  return <SpaceHeaderBackdropImage key={bannerSrc} bannerSrc={bannerSrc} />
}

function SpaceHeaderBackdropImage({ bannerSrc }) {
  const [failed, setFailed] = useState(false)
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-surface-container-low">
      {bannerSrc && !failed && (
        <img
          className="h-full w-full object-cover"
          src={bannerSrc}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/30 to-surface" />
    </div>
  )
}
