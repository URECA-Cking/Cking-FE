import { useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { CREATOR_FILTERS, CREATOR_SORTS } from '../../utils/exploreCreatorSection.js'

/** 크리에이터 목록 필터 칩(전체·관심·진행 중). 탐색 캐러셀과 전체 보기 화면이 같이 쓴다. */
export function CreatorFilterChips({ value, onChange, followedCount }) {
  return (
    <div className="px-margin mb-space-sm flex items-center gap-2" aria-label="크리에이터 목록 필터">
      {CREATOR_FILTERS.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`min-h-9 rounded-full px-3 py-1.5 font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
            value === item
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          {item === '관심' ? `관심 ${followedCount}` : item}
        </button>
      ))}
    </div>
  )
}

/** 정렬 아이콘 버튼과 선택 메뉴. 선택하면 메뉴를 닫는다. */
export function CreatorSortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="정렬"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
      >
        <MaterialIcon name="swap_vert" className="text-[20px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-10 z-20 w-52 py-1 rounded-xl bg-surface-container-lowest shadow-card">
            {CREATOR_SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={value === option.id}
                onClick={() => { onChange(option.id); setOpen(false) }}
                className={`w-full h-10 px-3 flex items-center justify-between font-label-md text-label-md ${
                  value === option.id ? 'text-primary font-semibold' : 'text-on-surface'
                }`}
              >
                {option.label}
                {value === option.id && <MaterialIcon name="check" className="text-[18px]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
