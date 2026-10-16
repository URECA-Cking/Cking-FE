import { keepsRequestId } from './earnRetry.js'

/**
 * Creator Space 공유 보상을 요청하고 결과를 화면이 쓸 값으로 바꾼다.
 * 서버는 새 적립에는 EARN_ACCEPTED, 같은 requestId 재전송에는 ALREADY_PROCESSED, 다른 requestId로 이미 받은 뒤에는
 * DUPLICATE_MISSION(409)으로 답한다. 뒤의 둘은 이미 받은 것이므로 오류로 보이지 않고 완료로 처리하되, 이번 호출로 늘어난
 * 잔액이 없을 수 있어 화면이 "잔액이 보상액만큼 늘 것"이라고 기대하면 안 된다. 그래서 earned와 done을 구분한다.
 * 승인 여부를 모르는 실패는 같은 크리에이터의 다음 시도에서 같은 requestId를 쓰도록 pending에 남긴다.
 * @param pending { current: { creatorId, requestId } | null } 승인 불명 요청을 보관하는 ref
 * @param complete (creatorId, requestId) => Promise<{ code, data: { rewardAmount } }>
 * @returns { status: 'earned', rewardAmount } | { status: 'done' } | { status: 'failed', error }
 */
export async function requestShareReward({ pending, creatorId, complete, newId }) {
  const kept = pending.current?.creatorId === creatorId ? pending.current.requestId : null
  const requestId = kept ?? newId()
  pending.current = { creatorId, requestId }
  try {
    const { code, data } = await complete(creatorId, requestId)
    pending.current = null
    if (code !== 'EARN_ACCEPTED') return { status: 'done' }
    return { status: 'earned', rewardAmount: data?.rewardAmount }
  } catch (error) {
    if (error?.code === 'DUPLICATE_MISSION') {
      pending.current = null
      return { status: 'done' }
    }
    if (!keepsRequestId(error)) pending.current = null
    return { status: 'failed', error }
  }
}

/** 공유 보상 요청을 보낼 수 있는 상태인지 판별한다. 아직 받지 않은 SHARE 미션이 있는 로그인한 팬의 스페이스여야 한다. */
export function canRequestShareReward({ authenticated, isMine, ownershipKnown, mission }) {
  return Boolean(authenticated && !isMine && ownershipKnown && mission && !mission.completedToday)
}
