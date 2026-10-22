import { keepsRequestId } from './earnRetry.js'
import { readShareAttempt, removeShareAttempt, writeShareAttempt } from './shareAttempts.js'

/**
 * Creator Space 공유 보상을 요청하고 결과를 화면이 쓸 값으로 바꾼다.
 * 서버는 새 적립에는 EARN_ACCEPTED, 같은 requestId 재전송에는 ALREADY_PROCESSED로 답한다. 둘 다 서버가 승인한 것이다.
 * 반면 DUPLICATE_MISSION(409)은 승인을 뜻하지 않는다. 다른 requestId의 이전 요청이 선점만 하고 승인 전(PENDING)이어도
 * 같은 응답이 나오므로, 완료로 단정하지 않고 unconfirmed로 돌려 화면이 서버 미션 상태를 다시 읽어 확인하게 한다.
 * 승인 여부를 모르는 실패는 회원·크리에이터별로 requestId를 저장소에 남겨, 새로고침이나 다른 크리에이터 이동 뒤에도
 * 같은 requestId로 이어 간다. 요청을 보내기 전에 저장하고, 승인되거나 서버가 처리하지 않았다고 확정할 때만 지운다.
 * @param complete (creatorId, requestId) => Promise<{ code, data: { rewardAmount } }>
 * @returns { status: 'earned', rewardAmount } | { status: 'done' } | { status: 'unconfirmed' } | { status: 'failed', error }
 */
export async function requestShareReward({ memberId, creatorId, complete, newId, storage }) {
  const requestId = readShareAttempt(memberId, creatorId, storage)?.requestId ?? newId()
  writeShareAttempt(memberId, creatorId, { requestId }, storage)
  try {
    const { code, data } = await complete(creatorId, requestId)
    removeShareAttempt(memberId, creatorId, storage)
    if (code !== 'EARN_ACCEPTED') return { status: 'done' }
    return { status: 'earned', rewardAmount: data?.rewardAmount }
  } catch (error) {
    if (error?.code === 'DUPLICATE_MISSION') {
      // 방금 쓴 requestId는 거절됐으므로 보관할 이유가 없다. 원래 요청의 requestId를 잃었다면 FE 단독으로는 복구할 수 없다.
      removeShareAttempt(memberId, creatorId, storage)
      return { status: 'unconfirmed' }
    }
    if (!keepsRequestId(error)) removeShareAttempt(memberId, creatorId, storage)
    return { status: 'failed', error }
  }
}

/** 공유 보상 요청을 보낼 수 있는 상태인지 판별한다. 아직 받지 않은 SHARE 미션이 있는 로그인한 팬의 스페이스여야 한다. */
export function canRequestShareReward({ authenticated, memberId, isMine, ownershipKnown, mission }) {
  return Boolean(authenticated && memberId != null && !isMine && ownershipKnown && mission && !mission.completedToday)
}
