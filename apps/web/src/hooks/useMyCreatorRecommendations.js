import { useMemo, useRef } from 'react'
import { useAsync } from './useAsync.js'
import { getCreatorCatalog, getMyCreatorRecommendations } from '../api/creators.js'

// 추천은 BE 상한(20)까지 한 번에 받고 화면에서 나눠 보여준다. 더 보기마다 다시 받으면 응답 ID(수집 단위)가 바뀐다.
const RECOMMEND_MAX = 20

/**
 * 맞춤 추천 목록과 노출·클릭 수집용 응답 ID를 한 번에 돌려준다.
 *
 * - 추천 응답의 최신 이름·이미지·소개를 우선한다. 명시적인 null/빈 문자열은 삭제 값이며,
 *   핸들 등 응답에서 누락된 필드만 공개 크리에이터 목록(이벤트는 받지 않는다)으로 채운다.
 * - 조회 결과(와 실패)에 요청한 회원을 함께 담는다. 공용 useAsync는 의존성이 바뀌어도 이전 결과를 지우지 않아서,
 *   회원이 바뀌면 새 조회가 끝나기 전·실패한 뒤에도 이전 회원의 추천과 응답 ID를 내보내지 않는다.
 * - 추천 조회와 프로필 목록 조회를 따로 추적해, 어느 한쪽만 실패해도 "추천이 없다"로 보이지 않고 오류와 다시 시도로 이어진다.
 * - 추천 응답에는 항목이 있는데 프로필 목록에서 하나도 찾지 못하면(목록 캐시가 오래돼 새 크리에이터가 빠진 경우 등) 빈 추천이 아니라
 *   오류로 보고, 다시 시도에서 프로필 목록을 캐시 없이 새로 받는다. 일부만 못 찾으면 찾은 항목만 보여 준다.
 * - 추천 응답의 기여 관심 분야·팔로우 seed는 프로필과 결합한 뒤에도 보존해 카드의 추천 이유에 쓴다.
 * - 인기순 대체 여부도 현재 회원의 응답에서만 꺼내 화면 제목에 전달한다.
 *
 * @returns {{ items: object[], creatorsById: Map<number, object>, requestId: number|string|null, personalized: boolean|null, loading: boolean, error: string|null, reload: () => void, reloadRecommendations: () => void }}
 *   items는 현재 회원의 추천을 프로필과 결합한 목록이다. 아직 준비되지 않았거나 실패했으면 빈 배열이다.
 */
export function useMyCreatorRecommendations(memberId) {
  const recommendation = useAsync(
    () => getMyCreatorRecommendations({ size: RECOMMEND_MAX }).then(
      (result) => ({ owner: memberId, result }),
      (error) => { throw Object.assign(error, { recommendationOwner: memberId }) },
    ),
    [memberId],
    { enabled: memberId != null, fallbackMessage: '추천 크리에이터를 불러오지 못했어요.' },
  )
  // 다시 시도에서만 프로필 목록 캐시를 건너뛴다. 로더가 읽고 바로 되돌려 이후 조회는 평소대로 캐시를 쓴다.
  const forceCatalog = useRef(false)
  const catalog = useAsync(
    () => {
      const force = forceCatalog.current
      forceCatalog.current = false
      return getCreatorCatalog({ force })
    },
    [],
    { fallbackMessage: '크리에이터를 불러오지 못했어요.' },
  )

  const mine = recommendation.data?.owner === memberId ? recommendation.data.result : null
  const failed = recommendation.errorObject?.recommendationOwner === memberId
  const creatorsById = useMemo(
    () => new Map((catalog.data ?? []).map((creator) => [creator.creatorId, creator])),
    [catalog.data],
  )
  const items = useMemo(
    () => (mine?.items ?? []).map((item) => {
      const creator = creatorsById.get(item.creatorId)
      // 명시적인 null/빈 문자열은 최신 삭제 값이다. undefined인 누락 필드만 카탈로그로 보완한다.
      return creator ? { ...creator, ...Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) } : null
    }).filter(Boolean),
    [mine, creatorsById],
  )
  const joinFailed = Boolean(catalog.data) && (mine?.items.length ?? 0) > 0 && items.length === 0
  const error = (failed ? recommendation.error : null) ?? catalog.error
    ?? (joinFailed ? '추천 크리에이터의 프로필을 불러오지 못했어요.' : null)
  // 새 회원의 응답이 오기 전(이전 회원 결과만 남은 상태)과 두 조회가 진행 중일 때는 로딩으로 본다.
  const loading = !error && (recommendation.loading || catalog.loading || (memberId != null && !mine))

  return {
    items,
    creatorsById,
    requestId: mine?.requestId ?? null,
    personalized: mine?.personalized ?? null,
    loading,
    error,
    // 실패한 쪽만 다시 받는다. 둘 다 성공 상태였다면 추천을 새로 받는다.
    reload: () => {
      if (catalog.error || joinFailed) {
        forceCatalog.current = true
        catalog.reload()
      }
      if (failed || !(catalog.error || joinFailed)) recommendation.reload()
    },
    reloadRecommendations: recommendation.reload,
  }
}
