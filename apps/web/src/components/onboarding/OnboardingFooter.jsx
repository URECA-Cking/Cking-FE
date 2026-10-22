/** 온보딩 각 단계 하단에 고정되는 버튼 영역. 위쪽이 주 버튼, 아래쪽이 보조 버튼이다. */
export default function OnboardingFooter({ children }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-30 p-space-md pb-safe bg-surface-container-lowest/90 backdrop-blur-md shadow-xl rounded-t-2xl">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">{children}</div>
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-[#e11d48] active:scale-[0.98] text-white font-title-md text-title-md font-semibold flex items-center justify-center gap-1.5 shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      {...props}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="w-full py-2.5 text-center font-label-md text-label-md text-outline hover:text-on-surface transition-colors active:opacity-70 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  )
}
