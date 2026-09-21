import MaterialIcon from './MaterialIcon.jsx'

export default function BottomSheet({ open, onClose, title, eyebrow, children }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 bg-on-surface/40 backdrop-blur-md flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] mx-auto bg-surface-container-lowest rounded-t-[28px] shadow-2xl flex flex-col px-space-md pt-space-sm pb-space-lg max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full flex items-center justify-center py-space-xs mb-space-xs">
          <div className="w-10 h-1 rounded-full bg-surface-container-highest" />
        </div>

        {(title || onClose) && (
          <div className="flex items-start justify-between mb-space-md">
            <div>
              {eyebrow && (
                <div className="inline-flex items-center gap-space-xs mb-1">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
                  <span className="font-label-xs text-label-xs text-primary-container font-bold uppercase tracking-wide">
                    {eyebrow}
                  </span>
                </div>
              )}
              {title && (
                <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface font-extrabold tracking-tight">
                  {title}
                </h2>
              )}
            </div>
            {onClose && (
              <button
                aria-label="닫기"
                className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                onClick={onClose}
                type="button"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
