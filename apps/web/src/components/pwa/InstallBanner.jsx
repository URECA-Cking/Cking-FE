import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useInstallPrompt } from '../../pwa/useInstallPrompt.js'
import { getInstallGuide, INSTALL_GUIDE_OPTIONS } from '../../pwa/installGuide.js'

/** 홈 화면 설치(웹앱) 유도 배너. 현재 환경에 맞는 절차 또는 브라우저 설치 팝업을 제공한다. */
export default function InstallBanner() {
  const { visible, canInstall, environment, install, dismiss } = useInstallPrompt()
  const [selectedEnvironment, setSelectedEnvironment] = useState(null)
  const [showManualGuide, setShowManualGuide] = useState(false)
  const guide = getInstallGuide(selectedEnvironment ?? environment)
  const shouldShowGuide = !canInstall || showManualGuide

  if (!visible) return null

  /** 설치 팝업을 지원하는 환경에서 수동 안내의 펼침 상태를 바꾼다. */
  function toggleManualGuide() {
    setShowManualGuide((shown) => !shown)
  }

  /** 사용자가 고른 브라우저에 맞는 설치 절차를 표시한다. */
  function handleEnvironmentChange(event) {
    setSelectedEnvironment(event.target.value || null)
  }

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

      {canInstall && (
        <>
          <button
            type="button"
            onClick={install}
            className="w-full h-10 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
          >
            앱 설치하기
          </button>
          <button
            type="button"
            onClick={toggleManualGuide}
            className="self-center px-2 font-label-xs text-label-xs font-semibold text-primary"
          >
            {showManualGuide ? '직접 설치 방법 닫기' : '직접 설치 방법 보기'}
          </button>
        </>
      )}

      {shouldShowGuide && (
        <>
          {!environment && (
            <label className="flex flex-col gap-1 font-label-xs text-label-xs text-on-surface-variant">
              사용하는 브라우저를 선택해주세요.
              <select
                aria-label="설치 방법을 볼 브라우저 선택"
                value={selectedEnvironment ?? ''}
                onChange={handleEnvironmentChange}
                className="h-10 rounded-xl border border-border-rose bg-surface-container-lowest px-3 text-on-surface"
              >
                <option value="">브라우저 선택</option>
                {INSTALL_GUIDE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

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
        </>
      )}
    </div>
  )
}
