import { useState } from 'react'
import { getCreatorRecommendationsByTags, getRecommendationTagCatalog } from '../../api/creators.js'
import { describeError } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useOwnCreatorId } from '../../hooks/useOwnCreatorId.js'
import { useRecommendationEvents } from '../../hooks/useRecommendationEvents.js'
import { useUser } from '../../context/useUser.js'
import { useToast } from '../../context/useToast.js'
import { EmptyBlock, ErrorBlock, LoadingBlock, SectionHeader } from '../ui/States.jsx'
import CreatorRow from './CreatorRow.jsx'

/** 관심 분야 저장이나 개인화 추천을 호출하지 않는 독립 검색 화면. */
export default function TagRecommendations() {
  const catalog = useAsync(getRecommendationTagCatalog, [], { fallbackMessage: '검색 태그를 불러오지 못했어요.' })
  return (
    <section className="mt-space-md px-margin pb-8 flex flex-col gap-3">
      <SectionHeader icon="tag" title="태그로 찾기" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">크리에이터가 공개 확인한 태그로 찾아요. 여러 태그를 고르면 하나 이상 일치하는 크리에이터를 보여드려요. 내 관심 분야는 변경되지 않아요.</p>
      {catalog.loading && <LoadingBlock label="검색 태그를 불러오는 중..." />}
      {!catalog.loading && catalog.error && <ErrorBlock message={catalog.error} onRetry={catalog.reload} />}
      {!catalog.loading && !catalog.error && catalog.data && (
        <TagPicker key={`${catalog.data.taxonomyVersion}:${catalog.data.taxonomyHash}`} catalog={catalog.data} reloadCatalog={catalog.reload} />
      )}
    </section>
  )
}

function TagPicker({ catalog, reloadCatalog }) {
  const [picked, setPicked] = useState([])
  const keyOf = (tag) => `${tag.type}:${tag.code}`
  function toggle(tag) {
    const key = keyOf(tag)
    setPicked((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key)
      const count = catalog.tags.filter((item) => item.type === tag.type && current.includes(keyOf(item))).length
      const max = tag.type === 'PARENT' ? catalog.maxParents : catalog.maxTopics
      return count < max ? [...current, key] : current
    })
  }
  const selected = catalog.tags.filter((tag) => picked.includes(keyOf(tag)))
  const parentCodes = selected.filter((tag) => tag.type === 'PARENT').map((tag) => tag.code)
  const topicCodes = selected.filter((tag) => tag.type === 'TOPIC').map((tag) => tag.code)
  const selection = { taxonomyVersion: catalog.taxonomyVersion, parentCodes, topicCodes }
  return (
    <>
      {['PARENT', 'TOPIC'].map((type) => {
        const tags = catalog.tags.filter((tag) => tag.type === type)
        const count = selected.filter((tag) => tag.type === type).length
        const max = type === 'PARENT' ? catalog.maxParents : catalog.maxTopics
        const label = type === 'PARENT' ? '상위 태그' : '세부 태그'
        return (
          <fieldset key={type} className="min-w-0 flex flex-col gap-2">
            <legend className="font-label-sm text-label-sm text-on-surface-variant mb-2">{label} ({count}/{max})</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const pressed = picked.includes(keyOf(tag))
                return (
                  <button key={tag.code} type="button" aria-pressed={pressed} disabled={!pressed && count >= max}
                    title={tag.description} onClick={() => toggle(tag)}
                    className={`px-3 py-2 rounded-full font-label-sm text-label-sm disabled:opacity-40 ${pressed ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
      {picked.length > 0 && <button type="button" onClick={() => setPicked([])} className="self-start text-primary font-label-sm text-label-sm">선택 초기화</button>}
      {picked.length === 0
        ? <EmptyBlock icon="tag" message="찾고 싶은 태그를 선택해 주세요." />
        // 선택마다 이전 결과·오류·요청 ID와 진행 중 응답을 함께 폐기한다. 회원 변경은 상위 key로 격리한다.
        : <TagResults key={JSON.stringify(selection)} selection={selection} reloadCatalog={reloadCatalog} />}
    </>
  )
}

function TagResults({ selection, reloadCatalog }) {
  const result = useAsync(() => getCreatorRecommendationsByTags({ ...selection, size: 20 }), [], {
    fallbackMessage: '태그 추천을 불러오지 못했어요.',
  })
  const { toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const { ownCreatorId, ownSpacePending } = useOwnCreatorId()
  const toast = useToast()
  const ready = !result.loading && !result.error && result.data?.rankingStatus === 'READY'
  const { impressionRef, trackClick } = useRecommendationEvents(ready ? result.data.requestId : null)
  async function follow(creator) {
    try {
      const changed = await toggleFollow(creator.creatorId)
      if (changed) toast(changed.following ? `${creator.name} 도킹 완료!` : '도킹이 해제되었어요.')
    } catch (error) {
      toast(describeError(error, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }
  if (result.loading) return <LoadingBlock label="일치하는 크리에이터를 찾는 중..." />
  if (result.error) return (
    <>
      <ErrorBlock message={result.error} onRetry={result.reload} />
      {['INVALID_CONTENT_TAG', 'CONTENT_TAXONOMY_UNAVAILABLE'].includes(result.errorObject?.code) && (
        <button type="button" onClick={reloadCatalog} className="text-primary font-label-sm text-label-sm">최신 태그 다시 불러오기</button>
      )}
    </>
  )
  if (!ready) return <EmptyBlock icon="update" message="추천 순위를 갱신하고 있어요. 잠시 후 다시 확인해 주세요."
    action={<button type="button" onClick={result.reload} className="text-primary">다시 확인</button>} />
  if (result.data.items.length === 0) return <EmptyBlock icon="person_search" message="선택한 태그와 관련된 크리에이터가 없어요." />
  return (
    <div className="flex flex-col gap-2.5">
      <p role="status" className="font-body-sm text-body-sm text-outline">일치하는 크리에이터 {result.data.items.length}명</p>
      {result.data.items.map((creator) => (
        <CreatorRow key={creator.creatorId} creator={creator} followed={isFollowing(creator.creatorId)}
          disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
          onToggle={follow}
          rowRef={result.data.requestId ? impressionRef(creator.creatorId) : undefined}
          onOpen={result.data.requestId ? () => trackClick(creator.creatorId) : undefined} />
      ))}
    </div>
  )
}
