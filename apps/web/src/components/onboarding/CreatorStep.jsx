import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import FollowStatus from '../creator/FollowStatus.jsx'
import OnboardingFooter, { GhostButton, PrimaryButton } from './OnboardingFooter.jsx'
import { getMyCreatorRecommendations, searchCreators } from '../../api/creators.js'
import { getInterests } from '../../api/interests.js'
import { getMySpace } from '../../api/creatorSpace.js'
import { describeError } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { CREATOR_SUBTAGS } from '../../data/creatorSubtagsDummy.js'
import { loadDummySubtags, subtagName, subtagsExperimentOn } from '../../data/interestSubtagsDummy.js'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

/** 추천 이유 문구. 인기순 대체에서는 이유가 없다. */
function reasonOf(item, interestNames) {
  const names = item.interestCodes.map((code) => interestNames.get(code)).filter(Boolean)
  if (names.length > 0) return `관심 분야 · ${names.join(', ')}`
  if (item.seedCreatorIds.length > 0) return '내가 관심 있는 크리에이터와 비슷해요'
  return null
}

async function loadRecommendations() {
  const [recommendation, interests] = await Promise.all([
    getMyCreatorRecommendations({ size: 20 }),
    // 분야 이름은 추천 이유 표시에만 쓰므로 실패해도 추천 자체는 보여준다.
    getInterests().catch(() => null),
  ])
  const interestNames = new Map((interests?.items ?? []).map((item) => [item.interestCode, item.name]))
  return { ...recommendation, interestNames }
}

/**
 * 이름 검색 + 더 보기. 첫 페이지는 검색어가 바뀔 때마다 새로 조회하고(useAsync가 이전 응답을 버린다),
 * 다음 페이지는 버튼을 눌렀을 때만 이어 붙인다. 이어 붙인 목록은 검색어가 달라지면 쓰지 않는다.
 */
function useCreatorSearch(keyword) {
  const first = useAsync(() => searchCreators({ keyword, page: 0, size: PAGE_SIZE }), [keyword], {
    fallbackMessage: '크리에이터를 불러오지 못했어요.',
  })
  const [more, setMore] = useState({ keyword: null, items: [], page: 0, hasNext: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(null)

  const extra = more.keyword === keyword ? more : { items: [], page: 0, hasNext: null }
  const ready = !first.loading && first.data
  const items = ready ? [...first.data.items, ...extra.items] : []
  const hasNext = ready ? (extra.hasNext ?? first.data.hasNext) : false

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const result = await searchCreators({ keyword, page: extra.page + 1, size: PAGE_SIZE })
      setMore((prev) => ({
        keyword,
        items: prev.keyword === keyword ? [...prev.items, ...result.items] : result.items,
        page: result.page,
        hasNext: result.hasNext,
      }))
    } catch (err) {
      setMoreError(describeError(err, '다음 크리에이터를 불러오지 못했어요.'))
    } finally {
      setLoadingMore(false)
    }
  }

  return { items, hasNext, loading: first.loading, loadingMore, error: first.error, moreError, reload: first.reload, loadMore }
}

function Avatar({ src, name }) {
  if (src) return <img className="w-14 h-14 rounded-full object-cover bg-surface-container-high shrink-0" src={src} alt="" />
  return (
    <div
      className="w-14 h-14 rounded-full bg-berry-tint text-primary flex items-center justify-center font-title-md text-title-md font-bold shrink-0"
      aria-hidden="true"
    >
      {name?.slice(0, 1)}
    </div>
  )
}

function CreatorRow({ creator, reason, followed, disabled, onToggle, subtags = [], mySubtags = [] }) {
  return (
    <li className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-lowest shadow-card">
      {/* 플로우: 추천·검색 결과에서 크리에이터 스페이스를 둘러본 뒤 팔로우를 정한다. 팔로우 버튼은 링크 밖에 둔다. */}
      <Link to={`/creators/${creator.creatorId}`} className="min-w-0 flex-1 flex items-center gap-3">
        <Avatar src={creator.avatar} name={creator.name} />
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
          {creator.bio && <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{creator.bio}</p>}
          {subtags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1" aria-label="세부 태그">
              {subtags.map((code) => (
                <span
                  key={code}
                  className={`px-2 py-0.5 rounded-full font-label-xs text-label-xs ${
                    mySubtags.includes(code) ? 'bg-secondary text-on-secondary font-semibold' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  #{subtagName(code)}
                </span>
              ))}
            </div>
          )}
          {reason && (
            <span className="mt-1 self-start max-w-full truncate px-2 py-0.5 rounded-full bg-berry-tint font-label-xs text-label-xs text-primary">
              {reason}
            </span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={followed}
        className={`shrink-0 h-9 px-3 rounded-full font-label-md text-label-md font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
          followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
        }`}
      >
        <MaterialIcon name={followed ? 'check' : 'add'} className="text-[16px]" />
        {followed ? '관심 중' : '관심 추가'}
      </button>
    </li>
  )
}

/**
 * 온보딩 2단계: 크리에이터 추천(기본) / 직접 찾기.
 *
 * 추천은 화면을 열 때 한 번만 불러온다. BE는 이미 팔로우한 크리에이터를 추천에서 빼므로,
 * 팔로우한 카드가 목록에서 사라져 화면이 흔들리지 않도록 머무는 동안은 다시 불러오지 않고 "관심 중"으로 유지한다.
 */
export default function CreatorStep({ onFinish, finishLabel = '시작하기', showSkip = true, busy = false }) {
  const showToast = useToast()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds, isCreator } = useUser()
  const [mode, setMode] = useState('recommend')
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')

  // 크리에이터는 본인을 팔로우할 수 없어서 본인 카드의 버튼을 막는다. 본인 Space를 읽는 동안에만 전체를 막는다.
  // Space가 없는 기존 Creator는 이 조회가 404이고 일시적인 오류도 날 수 있는데, 그때 막힌 채로 두면 팔로우를 아예 못 한다.
  // 조회가 실패하면 풀어 두고, 본인 팔로우는 BE가 SELF_FOLLOW_NOT_ALLOWED(400)로 거절해 안내 문구가 토스트로 나온다.
  const mySpace = useAsync(
    () => getMySpace().then((space) => ({ ...space, memberId: user.memberId })),
    [isCreator, user?.memberId],
    { enabled: isCreator },
  )
  const ownSpacePending = isCreator && mySpace.loading
  const ownCreatorId =
    isCreator && !mySpace.loading && mySpace.data?.memberId === user?.memberId ? mySpace.data.creatorId : null

  const recommended = useAsync(loadRecommendations, [], { fallbackMessage: '추천 크리에이터를 불러오지 못했어요.' })
  const search = useCreatorSearch(keyword)

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(input.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const interestNames = useMemo(() => recommended.data?.interestNames ?? new Map(), [recommended.data])

  async function handleToggle(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 관심 등록 완료!` : '관심 크리에이터에서 해제되었어요.')
    } catch (err) {
      showToast(describeError(err, '관심 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  // 실험: 크리에이터에게 할당한 세부 태그(더미)를 카드에 보여주고, 온보딩 1단계에서 고른 세부 태그와 겹치면 강조한다.
  const subtagsOn = subtagsExperimentOn()
  const mySubtags = useMemo(() => (subtagsOn ? loadDummySubtags(user?.memberId) : []), [subtagsOn, user?.memberId])
  const subtagsOf = (creator) => (subtagsOn ? (CREATOR_SUBTAGS[creator.name?.replace('[시연] ', '')] ?? []) : [])

  // 실험: 내가 고른 세부 태그와 겹치는 추천을 위로 올린다(겹치는 수가 많은 순). 겹침이 같으면 BE가 준 순서를 그대로 둔다.
  // 서버 추천 자체는 상위 분야 기준이라 이 재정렬은 화면에서만 일어난다(이슈 #83).
  const recommendedItems = useMemo(() => {
    const items = recommended.data?.items ?? []
    if (!subtagsOn || mySubtags.length === 0) return items
    const matches = (creator) => subtagsOf(creator).filter((code) => mySubtags.includes(code)).length
    return items
      .map((item, index) => ({ item, index, score: matches(item) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ item }) => item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended.data, subtagsOn, mySubtags])
  const reordered = subtagsOn && mySubtags.length > 0 && recommendedItems.some((item, i) => item !== recommended.data?.items[i])

  const rowProps = (creator) => ({
    subtags: subtagsOf(creator),
    mySubtags,
    creator,
    followed: isFollowing(creator.creatorId),
    disabled: !followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId,
    onToggle: () => handleToggle(creator),
  })

  const personalized = recommended.data?.personalized
  const followedCount = followedCreators.length

  return (
    <>
      <div className="pt-16 px-space-md flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          {mode === 'recommend' ? (personalized === false ? '지금 인기 있는 크리에이터' : '나를 위한 추천') : '크리에이터 찾기'}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {mode === 'recommend'
            ? personalized === false
              ? '아직 취향 정보가 부족해서 인기 크리에이터를 보여줘요.'
              : '고른 분야와 관심 크리에이터를 바탕으로 추천해요.'
            : '이름으로 검색해서 관심 크리에이터를 골라봐요.'}
        </p>
      </div>

      <FollowStatus />

      <div className="px-space-md mt-4 flex gap-2" role="group" aria-label="보기 방식">
        {[
          ['recommend', '추천'],
          ['search', '직접 찾기'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={`px-4 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all active:scale-95 ${
              mode === id ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'recommend' && (
        <div className="px-space-md mt-4 flex flex-col">
          {recommended.loading && <LoadingBlock label="추천 크리에이터를 찾는 중..." />}
          {!recommended.loading && recommended.error && (
            <ErrorBlock message={recommended.error} onRetry={recommended.reload} />
          )}
          {!recommended.loading && !recommended.error && (recommended.data?.items.length ?? 0) === 0 && (
            <EmptyBlock
              icon="person_search"
              message="지금은 추천할 크리에이터가 없어요."
              action={
                <button type="button" onClick={() => setMode('search')} className="font-label-md text-label-md font-semibold text-primary">
                  직접 찾아보기
                </button>
              }
            />
          )}
          {!recommended.loading && !recommended.error && (recommended.data?.items.length ?? 0) > 0 && (
            <ul className="flex flex-col gap-2.5">
              {reordered && (
                <li className="px-1 font-label-xs text-label-xs text-outline list-none" aria-live="polite">
                  실험: 고른 세부 태그와 겹치는 크리에이터를 위로 올렸어요.
                </li>
              )}
              {recommendedItems.map((item) => (
                <CreatorRow key={item.creatorId} {...rowProps(item)} reason={reasonOf(item, interestNames)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === 'search' && (
        <div className="px-space-md mt-4 flex flex-col gap-3">
          <div className="relative flex items-center w-full">
            <MaterialIcon name="search" className="absolute left-3.5 text-primary/60 text-title-lg pointer-events-none" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={50}
              className="w-full h-11 pl-11 pr-4 bg-surface-container rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="크리에이터 이름 검색"
              type="search"
              aria-label="크리에이터 이름 검색"
            />
          </div>
          {search.error && <ErrorBlock message={search.error} onRetry={search.reload} />}
          {!search.error && search.items.length === 0 && search.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
          {!search.error && !search.loading && search.items.length === 0 && (
            <EmptyBlock icon="person_search" message={keyword ? '검색 결과가 없어요.' : '아직 등록된 크리에이터가 없어요.'} />
          )}
          {search.items.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {search.items.map((creator) => (
                <CreatorRow key={creator.creatorId} {...rowProps(creator)} reason={null} />
              ))}
            </ul>
          )}
          {search.moreError && <p role="alert" className="text-center font-body-sm text-body-sm text-error">{search.moreError}</p>}
          {search.hasNext && !search.error && (
            <button
              type="button"
              onClick={search.loadMore}
              disabled={search.loadingMore}
              className="self-center px-5 py-2 rounded-full bg-surface-container font-label-md text-label-md font-semibold text-on-surface-variant disabled:opacity-50"
            >
              {search.loadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          )}
        </div>
      )}

      <OnboardingFooter>
        <PrimaryButton onClick={onFinish} disabled={busy}>
          <span>{finishLabel}</span>
          {followedCount > 0 && (
            <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium backdrop-blur-sm">
              {followedCount}명 관심 중
            </span>
          )}
        </PrimaryButton>
        {showSkip && <GhostButton onClick={onFinish} disabled={busy}>나중에 할게</GhostButton>}
      </OnboardingFooter>
    </>
  )
}
