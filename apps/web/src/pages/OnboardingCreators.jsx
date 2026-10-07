import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useUser } from '../context/useUser.js'
import { useToast } from '../context/useToast.js'
import FollowStatus from '../components/creator/FollowStatus.jsx'
import { describeError } from '../api/client.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { useVisibleCreatorIds } from '../hooks/useVisibleCreatorIds.js'
import { getMySpace } from '../api/creatorSpace.js'
import { formatNumber } from '../utils/format.js'

/**
 * 관심 크리에이터 선택(온보딩 2단계).
 *
 * 공개 Creator 목록 API에서 전체 크리에이터의 실제 프로필을 읽는다.
 * 선택 결과는 서버에 저장되어 홈·탐색 화면에도 반영된다.
 */
export default function OnboardingCreators() {
  const pageRef = useRef(null)
  const navigate = useNavigate()
  const { user, followedCreators, toggleFollow, followsReady, pendingFollowIds, isCreator } = useUser()
  const mySpace = useAsync(
    () => getMySpace().then((space) => ({ ...space, memberId: user.memberId })),
    [isCreator, user?.memberId],
    { enabled: isCreator },
  )
  const ownSpaceReady = isCreator && !mySpace.loading && mySpace.data?.memberId === user?.memberId
  const ownCreatorId = ownSpaceReady ? mySpace.data.creatorId : null
  const ownSpacePending = isCreator && !ownSpaceReady
  const showToast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('전체')

  const { data, loading, error, reload } = useAsync(
    () => loadCreatorDirectory(),
    [],
    { fallbackMessage: '크리에이터 목록을 불러오지 못했습니다.' },
  )

  const creators = useMemo(() => data?.creators ?? [], [data])

  const visibleCreators = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return creators.filter((creator) => {
      const matchesCategory = filter === '전체' || followedCreators.includes(creator.creatorId)
      const matchesQuery =
        !keyword ||
        creator.name.toLowerCase().includes(keyword)
      return matchesCategory && matchesQuery
    })
  }, [creators, filter, query, followedCreators])
  const visibleBalanceIds = useVisibleCreatorIds(pageRef, visibleCreators.map((creator) => creator.creatorId))
  const { balances, failedIds, retry: retryBalances, loading: balancesLoading } = useCreatorBalances(visibleBalanceIds, user?.memberId)

  const selectedCount = followedCreators.length

  async function handleToggleFollow(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 관심 등록 완료!` : '관심 크리에이터에서 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '관심 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  return (
    <div ref={pageRef} className="flex flex-col w-full min-h-screen pt-safe pb-36">
      <BackHeader title="" badge="Cking 단계 2/2" onBack={() => navigate(-1)} />
      <div className="pt-16 px-space-md flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">관심 크리에이터 선택</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          좋아하는 크리에이터를 선택해줘 (언제든 변경할 수 있어)
        </p>
      </div>

      <FollowStatus />

      <div className="px-space-md mt-4 mb-4">
        <div className="relative flex items-center w-full">
          <MaterialIcon name="search" className="absolute left-3.5 text-primary/60 text-title-lg pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-surface-container rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all"
            placeholder="크리에이터 검색 (예: IVE, DAY6...)"
            type="search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-space-md overflow-x-auto no-scrollbar mb-4">
        {['전체', '관심'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`font-label-xs text-label-xs px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all active:scale-95 ${
              filter === item
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {item === '전체' ? '전체 보기' : '관심 중'}
          </button>
        ))}
      </div>

      {loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {failedIds.size > 0 && !error && (
        <button type="button" onClick={retryBalances} disabled={balancesLoading} className="mx-space-md self-start font-label-sm text-label-sm text-primary disabled:opacity-50">
          응모권 잔액 다시 조회
        </button>
      )}
      {!loading && !error && visibleCreators.length === 0 && (
        <EmptyBlock icon="person_search" message="조건에 맞는 크리에이터가 없어요." />
      )}

      {!loading && !error && visibleCreators.length > 0 && (
        <div className="px-space-md grid grid-cols-2 gap-3">
          {visibleCreators.map((creator) => {
            const isSelected = followedCreators.includes(creator.creatorId)
            return (
              <button
                type="button"
                key={creator.creatorId}
                data-balance-creator-id={creator.creatorId}
                onClick={() => handleToggleFollow(creator)}
                disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
                aria-pressed={isSelected}
                className={`relative flex flex-col p-3.5 rounded-xl bg-surface-container-lowest shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98] text-left border disabled:opacity-60 disabled:cursor-not-allowed ${
                  isSelected ? 'border-primary' : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-container-high">
                    <img className="w-full h-full object-cover" src={creator.avatar} alt={creator.name} />
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-berry-tint border border-border-rose text-primary/70'
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
                  이벤트 {formatNumber(creator.events.length)}개
                </span>
                <span className="mt-1.5 inline-flex items-center gap-1 self-start bg-surface-container px-2 py-0.5 rounded-full">
                  <span className="text-[11px]">🎟</span>
                  <span className="font-label-xs text-label-xs text-primary font-bold">
                    {balances.has(creator.creatorId)
                      ? `보유 ${formatNumber(balances.get(creator.creatorId).balance)}장`
                      : failedIds.has(creator.creatorId) ? '잔액 조회 실패' : '잔액 조회 중'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-30 p-space-md pb-safe bg-surface-container-lowest/90 backdrop-blur-md shadow-xl rounded-t-2xl">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-[#e11d48] active:scale-[0.98] text-white font-title-md text-title-md font-semibold flex items-center justify-center gap-1.5 shadow-lg transition-all"
        >
          <span>{selectedCount > 0 ? '시작하기' : '크리에이터 선택하기'}</span>
          {selectedCount > 0 && (
            <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium backdrop-blur-sm">
              {selectedCount}명 선택됨
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="w-full py-2.5 text-center font-label-md text-label-md text-outline hover:text-on-surface transition-colors active:opacity-75"
        >
          나중에 할게
        </button>
        </div>
      </div>
    </div>
  )
}
