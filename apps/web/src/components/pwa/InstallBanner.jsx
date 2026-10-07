import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useInstallPrompt } from '../../pwa/useInstallPrompt.js'

/** 홈 화면 설치(웹앱) 유도 배너. 설치 가능하거나 iOS일 때만 노출된다. */
export default function InstallBanner() {
  const { visible, canInstall, needsIosGuide, install, dismiss } = useInstallPrompt()
  const [showIosGuide, setShowIosGuide] = useState(false)

  if (!visible) return null

  return (
    <div className="mx-margin mt-space-sm rounded-2xl bg-surface-container-lowest border border-border-rose shadow-card p-space-md flex flex-col gap-space-sm">
      <div className="flex items-start gap-space-sm">
        <div className="w-10 h-10 rounded-xl bg-berry-tint flex items-center justify-center text-primary shrink-0">
          <MaterialIcon name="install_mobile" className="text-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-label-md text-label-md font-bold text-on-surface">Cking을 앱처럼 쓰기</p>
          <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5 leading-relaxed">
            홈 화면에 추가하면 주소창 없이 전체 화면으로 실행되고, 오프라인에서도 마지막 화면을 볼 수 있어요.
          </p>
        </div>
        <button
          type="button"
          aria-label="설치 안내 닫기"
          onClick={dismiss}
          className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container shrink-0"
        >
          <MaterialIcon name="close" className="text-[18px]" />
        </button>
      </div>

      {showIosGuide && (
        <p className="font-label-xs text-label-xs text-berry-deep bg-berry-tint rounded-xl px-3 py-2 leading-relaxed">
          Safari 하단의 공유 버튼을 누른 뒤 &ldquo;홈 화면에 추가&rdquo;를 선택해주세요.
        </p>
      )}

      <button
        type="button"
        onClick={() => (canInstall ? install() : setShowIosGuide(true))}
        className="w-full h-10 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
      >
        {canInstall ? '홈 화면에 추가' : needsIosGuide ? '추가 방법 보기' : '홈 화면에 추가'}
      </button>
    </div>
  )
}
