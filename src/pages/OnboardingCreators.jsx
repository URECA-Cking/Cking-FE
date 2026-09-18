import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { creators } from '../data/creators.js'

const FILTERS = ['전체 추천', 'K-POP', '밴드 음악', '토크/예능', '경제/이슈']
const DEFAULT_SELECTED = ['ive', 'day6', 'aespa']

export default function OnboardingCreators() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set(DEFAULT_SELECTED))

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleCreators = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return creators
    return creators.filter(
      (creator) => creator.name.toLowerCase().includes(q) || creator.category.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title="" badge="Cking 단계 1/2" onBack={() => navigate(-1)} />
      <div className="pt-16 px-space-md flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">관심 크리에이터 선택</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          좋아하는 크리에이터를 선택해줘 (언제든 변경할 수 있어)
        </p>
      </div>

      <div className="px-space-md mt-4 mb-4">
        <div className="relative flex items-center w-full">
          <MaterialIcon name="search" className="absolute left-3.5 text-primary/60 text-title-lg pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-surface-container rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all"
            placeholder="크리에이터 검색 (예: IVE, DAY6...)"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-space-md overflow-x-auto no-scrollbar mb-4">
        {FILTERS.map((filter, index) => (
          <span
            key={filter}
            className={`font-label-xs text-label-xs px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap ${
              index === 0 ? 'bg-primary text-white shadow-sm' : 'bg-surface-container text-on-surface-variant font-medium'
            }`}
          >
            {filter}
          </span>
        ))}
      </div>

      <div className="px-space-md grid grid-cols-2 gap-3">
        {visibleCreators.map((creator) => {
          const isSelected = selected.has(creator.id)
          return (
            <button
              type="button"
              key={creator.id}
              onClick={() => toggle(creator.id)}
              className="relative flex flex-col p-3.5 rounded-xl bg-surface-container-lowest shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98] text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-container-high">
                  <img className="w-full h-full object-cover" src={creator.avatar} alt={creator.name} />
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${
                    isSelected ? 'bg-primary text-white shadow-pink-200' : 'bg-berry-tint border border-border-rose text-primary/70'
                  }`}
                >
                  <MaterialIcon name={isSelected ? 'check' : 'add'} className="text-sm font-bold" />
                </div>
              </div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
                <MaterialIcon name="verified" filled className="text-xs text-primary" />
              </div>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {creator.followers} 구독자 · {creator.category}
              </span>
            </button>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30 p-space-md bg-surface-container-lowest/90 backdrop-blur-md shadow-xl flex flex-col gap-2 rounded-t-2xl">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-[#e11d48] active:scale-[0.98] text-white font-title-md text-title-md font-semibold flex items-center justify-center gap-1.5 shadow-lg transition-all"
        >
          <span>{selected.size > 0 ? '시작하기' : '크리에이터 선택하기'}</span>
          {selected.size > 0 && (
            <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium backdrop-blur-sm">
              {selected.size}명 선택됨
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full py-2.5 text-center font-label-md text-label-md text-outline hover:text-on-surface transition-colors active:opacity-75"
        >
          나중에 할게
        </button>
      </div>
    </div>
  )
}
