import { useMemo, useState } from 'react'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { exploreCreators, trendingCreators, newCreators } from '../data/creators.js'
import { useToast } from '../context/ToastContext.jsx'

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'kpop', label: 'K-POP' },
  { id: 'band', label: '밴드' },
  { id: 'streamer', label: '스트리머' },
  { id: 'tech', label: '테크' },
  { id: 'daily', label: '일상' },
  { id: 'webtoon', label: '웹툰/일러스트' },
]

export default function Explore() {
  const showToast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [followed, setFollowed] = useState(() => new Set())
  const [added, setAdded] = useState(() => new Set())

  function toggleFollow(id, name) {
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        showToast('관심 크리에이터에서 해제되었습니다.')
      } else {
        next.add(id)
        showToast(`${name} 관심 크리에이터로 등록되었어요! 💖`)
      }
      return next
    })
  }

  function toggleAdd(id) {
    setAdded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        showToast('관심 크리에이터 목록에서 제외되었습니다.')
      } else {
        next.add(id)
        showToast('관심 크리에이터에 쏙 담았어요! 🎉')
      }
      return next
    })
  }

  const filteredNewCreators = useMemo(() => {
    return newCreators.filter((creator) => {
      const matchesCategory = category === 'all' || creator.tag === category
      const matchesQuery = query.trim().length === 0 || creator.name.toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="px-margin pt-space-md pb-space-sm flex flex-col gap-space-sm">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
            <MaterialIcon name="search" className="text-[20px]" />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all shadow-sm"
            placeholder="크리에이터를 검색해봐 (아티스트, 유튜버, 스트리머)"
            type="text"
          />
          {query && (
            <button
              type="button"
              aria-label="지우기"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-on-surface transition-colors"
            >
              <MaterialIcon name="cancel" className="text-[18px]" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-space-xs px-2 py-1 bg-surface-container-low rounded-lg">
          <MaterialIcon name="local_fire_department" className="text-primary text-[16px] animate-pulse" />
          <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
            실시간 관심 급증: 밴드 루시 &amp; 침착맨 래플 티켓 오픈 10분 전!
          </span>
        </div>
      </div>

      <section className="mt-space-md flex flex-col">
        <div className="px-margin flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="auto_awesome" className="text-primary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">추천 크리에이터</h2>
          </div>
          <span className="font-label-xs text-label-xs text-primary font-semibold">이번 주 큐레이션</span>
        </div>
        <div className="flex overflow-x-auto gap-space-md px-margin no-scrollbar snap-x snap-mandatory pt-1 pb-3">
          {exploreCreators.map((creator) => {
            const isFollowed = followed.has(creator.id)
            return (
              <div
                key={creator.id}
                className="min-w-[260px] max-w-[260px] snap-center rounded-2xl bg-surface-container-lowest p-3 shadow-md flex flex-col relative group transition-transform active:scale-[0.99]"
              >
                <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3">
                  <img className="w-full h-full object-cover" src={creator.banner} alt={creator.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-xs text-label-xs font-semibold flex items-center gap-1">
                    <MaterialIcon name="stars" filled className="text-[12px]" />
                    {creator.badge}
                  </span>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white">
                    <span className="font-label-xs text-label-xs bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                      팔로워 {creator.followers}
                    </span>
                  </div>
                </div>
                <div className="mb-1.5">
                  <div className="flex items-center gap-1">
                    <h3 className="font-title-md text-title-md text-on-surface truncate">{creator.name}</h3>
                    <MaterialIcon name="verified" filled className="text-[16px] text-primary" />
                  </div>
                  <span className="font-label-xs text-label-xs text-on-surface-variant font-medium">
                    {creator.category}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-outline line-clamp-1 mb-3">{creator.description}</p>
                <button
                  type="button"
                  onClick={() => toggleFollow(creator.id, creator.name)}
                  className={`mt-auto w-full h-9 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    isFollowed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
                  }`}
                >
                  <MaterialIcon name="favorite" filled={isFollowed} className="text-[18px]" />
                  <span>{isFollowed ? '관심 중' : '관심 추가'}</span>
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-space-lg px-margin flex flex-col">
        <div className="flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="trending_up" className="text-tertiary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">지금 인기 있는 크리에이터</h2>
          </div>
          <span className="font-label-xs text-label-xs text-outline">실시간 집계</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {trendingCreators.map((creator, index) => {
            const isAdded = added.has(creator.id)
            return (
              <div
                key={creator.id}
                className="w-full p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-mono-metric text-primary w-4 text-center font-bold">{index + 1}</span>
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <img className="w-full h-full object-cover" src={creator.avatar} alt={creator.name} />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
                      <MaterialIcon name="verified" filled className="text-[15px] text-primary" />
                    </div>
                    <div className="flex items-center gap-1 text-secondary font-semibold">
                      <MaterialIcon name="arrow_drop_up" className="text-[14px]" />
                      <span className="font-label-xs text-label-xs">팬 활동 {creator.change}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAdd(creator.id)}
                  className={`flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 ${
                    isAdded ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
                  }`}
                >
                  <MaterialIcon name={isAdded ? 'done' : 'add'} className="text-[16px]" />
                  <span>{isAdded ? '완료' : '관심'}</span>
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-space-lg flex flex-col">
        <div className="px-margin flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="category" className="text-primary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">카테고리 탐색</h2>
          </div>
        </div>
        <div className="flex overflow-x-auto gap-2 px-margin no-scrollbar py-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md font-semibold whitespace-nowrap transition-all active:scale-95 ${
                category === cat.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-space-lg px-margin flex flex-col">
        <div className="flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="fiber_new" className="text-primary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">신규 입점 크리에이터</h2>
          </div>
          <span className="font-label-xs text-label-xs text-on-surface-variant">매일 업데이트</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filteredNewCreators.map((creator) => {
            const isAdded = added.has(creator.id)
            return (
              <div key={creator.id} className="bg-surface-container-lowest p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5">
                    <img className="w-full h-full object-cover" src={creator.avatar} alt={creator.name} />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white font-label-xs text-label-xs">
                      신규
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
                    <MaterialIcon name="verified" filled className="text-[14px] text-primary" />
                  </div>
                  <span className="font-label-xs text-label-xs text-on-surface-variant block mb-2">
                    {creator.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAdd(creator.id)}
                  className={`w-full h-8 rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    isAdded ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
                  }`}
                >
                  <MaterialIcon name={isAdded ? 'done' : 'add'} className="text-[16px]" />
                  <span>{isAdded ? '완료' : '관심'}</span>
                </button>
              </div>
            )
          })}
          {filteredNewCreators.length === 0 && (
            <p className="col-span-2 text-center text-body-sm text-on-surface-variant py-6">
              조건에 맞는 크리에이터가 없어요.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
