import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useInstallPrompt } from '../../pwa/useInstallPrompt.js'
import { getInstallGuide } from '../../pwa/installGuide.js'

/** 홈 화면 설치(웹앱) 유도 배너. 현재 환경에 맞는 절차 또는 브라우저 설치 팝업을 제공한다. */
export default function InstallBanner() {
  const { visible, canInstall, environment, install, dismiss } = useInstallPrompt()
  const [showManualGuide, setShowManualGuide] = useState(false)
  const guide = getInstallGuide(environment)

  if (!visible) return null

  /** 자동 감지된 설치 방법 안내의 펼침 상태를 바꾼다. */
  function toggleManualGuide() {
    setShowManualGuide((shown) => !shown)
  }

  return (
    <div className="mx-margin mt-space-sm rounded-2xl bg-surface-container-lowest border border-border-rose shadow-card px-space-md py-space-sm flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-sm">
        <div className="w-9 h-9 rounded-xl bg-berry-tint flex items-center justify-center text-primary shrink-0">
          <MaterialIcon name="install_mobile" className="text-[20px]" />
        </div>
        <p className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface break-keep">Cking을 앱처럼 쓰기</p>
        {canInstall ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-primary px-3 py-1 font-label-xs text-label-xs font-bold text-on-primary active:scale-[0.98] transition-all"
          >
            앱 설치하기
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleManualGuide}
            aria-expanded={showManualGuide}
            aria-controls="install-manual-guide"
            className="shrink-0 px-2 font-label-xs text-label-xs font-semibold text-primary"
          >
            {showManualGuide ? '설치 방법 닫기' : '설치 방법 보기'}
          </button>
        )}
        <button
          type="button"
          aria-label="설치 안내 닫기"
          onClick={dismiss}
          className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container shrink-0"
        >
          <MaterialIcon name="close" className="text-[18px]" />
        </button>
      </div>

      <div id="install-manual-guide" className={`${showManualGuide ? 'flex' : 'hidden'} flex-col gap-space-sm`}>
        <p className="font-label-xs text-label-xs text-on-surface-variant leading-relaxed">
          홈 화면에 추가하면 주소창 없이 전체 화면으로 실행되고, 오프라인에서도 마지막 화면을 볼 수 있어요.
        </p>

        {guide && (
          <div className="rounded-xl bg-berry-tint px-3 py-2 text-berry-deep">
            <p className="font-label-xs text-label-xs font-bold">{guide.label} 설치 방법</p>
            <ol className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5 font-label-xs text-label-xs leading-relaxed">
              {guide.steps.map((step, index) => (
                <li key={step}>
                  {index > 0 && <span aria-hidden="true"> → </span>}
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-1 font-label-xs text-label-xs leading-relaxed">{guide.note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
