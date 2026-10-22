import { useAsync } from './useAsync.js'
import { useUser } from '../context/useUser.js'
import { getMySpace } from '../api/creatorSpace.js'

/**
 * 크리에이터 본인의 creatorId. 내 스페이스를 불러오는 동안은 pending이라 관심 버튼을 막아 본인 팔로우를 방지한다.
 * 계정이 바뀐 직후 이전 계정의 응답을 쓰지 않도록 memberId가 같은 응답만 인정한다.
 * 내 creatorId는 로그인 동안 바뀌지 않으므로 회원별로 마지막 결과를 캐시해 화면을 다시 열 때 확인 중 표시가 깜빡이지 않게 한다(뒤에서 새로 불러온다).
 * 조회에 실패하면 ownSpacePending은 true로 남아 기존 사용처(관심 버튼 차단)의 동작은 같고, ownSpaceError와 reloadOwnSpace로 실패와 재시도를 구분할 수 있다.
 */
export function useOwnCreatorId() {
  const { user, isCreator } = useUser()
  const mySpace = useAsync(
    () => getMySpace().then((space) => ({ ...space, memberId: user.memberId })),
    [isCreator, user?.memberId],
    { enabled: isCreator, cacheKey: isCreator && user?.memberId != null ? `own-space:${user.memberId}` : null },
  )
  const ready = isCreator && !mySpace.loading && mySpace.data?.memberId === user?.memberId
  return {
    ownCreatorId: ready ? mySpace.data.creatorId : null,
    ownSpacePending: isCreator && !ready,
    ownSpaceError: isCreator && !ready && !mySpace.loading && Boolean(mySpace.error),
    reloadOwnSpace: mySpace.reload,
  }
}
