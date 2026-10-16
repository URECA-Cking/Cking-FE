import { useMemo } from 'react'
import { useAsync } from './useAsync.js'
import { getCreatorCatalog, getMyCreatorRecommendations } from '../api/creators.js'

// 추천은 BE 상한(20)까지 한 번에 받고 화면에서 나눠 보여준다. 더 보기마다 다시 받으면 응답 ID(수집 단위)가 바뀐다.
const RECOMMEND_MAX = 20

/**
 * 맞춤 추천 목록과 노출·클릭 수집용 응답 ID를 한 번에 돌려준다.
 *
 * - 추천 응답은 이름·이미지·소개만 주므로 핸들 등은 공개 크리에이터 목록(이벤트는 받지 않는다)의 같은 크리에이터로 채운다.
 * - 조회 결과(와 실패)에 요청한 회원을 함께 담는다. 공용 useAsync는 의존성이 바뀌어도 이전 결과를 지우지 않아서,
 *   회원이 바뀌면 새 조회가 끝나기 전·실패한 뒤에도 이전 회원의 추천과 응답 ID를 내보내지 않는다.
 * - 추천 조회와 프로필 목록 조회를 따로 추적해, 어느 한쪽만 실패해도 "추천이 없다"로 보이지 않고 오류와 다시 시도로 이어진다.
 *
 * @returns {{ items: object[], creatorsById: Map<number, object>, requestId: number|string|null, loading: boolean, error: string|null, reload: () => void, reloadRecommendations: () => void }}
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
  const catalog = useAsync(() => getCreatorCatalog(), [], { fallbackMessage: '크리에이터를 불러오지 못했어요.' })

  const mine = recommendation.data?.owner === memberId ? recommendation.data.result : null
  const failed = recommendation.errorObject?.recommendationOwner === memberId
  const creatorsById = useMemo(
    () => new Map((catalog.data ?? []).map((creator) => [creator.creatorId, creator])),
    [catalog.data],
  )
  const items = useMemo(
    () => (mine?.items ?? []).map((item) => creatorsById.get(item.creatorId)).filter(Boolean),
    [mine, creatorsById],
  )
  const error = (failed ? recommendation.error : null) ?? catalog.error
  // 새 회원의 응답이 오기 전(이전 회원 결과만 남은 상태)과 두 조회가 진행 중일 때는 로딩으로 본다.
  const loading = !error && (recommendation.loading || catalog.loading || (memberId != null && !mine))

  return {
    items,
    creatorsById,
    requestId: mine?.requestId ?? null,
    loading,
    error,
    // 실패한 쪽만 다시 받는다. 둘 다 성공 상태였다면 추천을 새로 받는다.
    reload: () => {
      if (catalog.error) catalog.reload()
      if (failed || !catalog.error) recommendation.reload()
    },
    reloadRecommendations: recommendation.reload,
  }
}
