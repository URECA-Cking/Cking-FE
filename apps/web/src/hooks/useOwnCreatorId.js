import { useAsync } from './useAsync.js'
import { useUser } from '../context/useUser.js'
import { getMySpace } from '../api/creatorSpace.js'

/**
 * 크리에이터 본인의 creatorId. 내 스페이스를 불러오는 동안은 pending이라 관심 버튼을 막아 본인 팔로우를 방지한다.
 * 계정이 바뀐 직후 이전 계정의 응답을 쓰지 않도록 memberId가 같은 응답만 인정한다.
 */
export function useOwnCreatorId() {
  const { user, isCreator } = useUser()
  const mySpace = useAsync(
    () => getMySpace().then((space) => ({ ...space, memberId: user.memberId })),
    [isCreator, user?.memberId],
    { enabled: isCreator },
  )
  const ready = isCreator && !mySpace.loading && mySpace.data?.memberId === user?.memberId
  return { ownCreatorId: ready ? mySpace.data.creatorId : null, ownSpacePending: isCreator && !ready }
}
