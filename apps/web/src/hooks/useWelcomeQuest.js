import { useCallback, useRef, useState } from 'react'
import { useAsync } from './useAsync.js'
import { ApiError, newRequestId } from '../api/client.js'
import { claimWelcomeQuestStep, getWelcomeQuest } from '../api/welcomeQuest.js'
import { keepsRequestId } from '../utils/earnRetry.js'
import { markStepClaimed } from '../utils/welcomeQuest.js'

/**
 * 웰컴 퀘스트 상태 조회와 단계별 지급 요청을 묶은 훅. 화면은 이 훅의 상태와 claim만 사용한다.
 * - quest: 서버 상태({ eligible, completed, items, bonus }). 불러오기 전에는 null이다.
 * - claim(step, { answer }): 지급을 요청한다. 성공하면 해당 단계를 CLAIMED로 맞추고 { step, rewardAmount, status }를 돌려준다.
 *   실패하면 ApiError를 던진다. 같은 단계의 요청이 이미 진행 중이면 보내지 않고 null을 돌려주므로,
 *   결과를 쓰기 전에 null인지 확인해야 한다. 다른 단계의 요청은 동시에 보낼 수 있다.
 *   승인 여부가 불확실한 요청이 남아 있으면, 새로 넘긴 answer와 상관없이 최초 요청의 requestId와 answer 그대로 다시 보낸다
 *   (같은 requestId는 요청 내용이 같아야 서버가 복구할 수 있다). 그 요청이 정리된 뒤에야 새 answer가 쓰인다.
 * - claimingSteps: 지금 지급 요청 중인 단계들. 버튼 비활성화·진행 표시에 쓴다.
 * 요청 ID와 진행 상태는 회원별로 따로 관리해, 계정이 바뀌어도 이전 회원의 requestId를 재사용하지 않는다.
 * 조회 결과도 요청한 회원과 함께 보관해, 계정이 바뀌면 새 조회가 끝나기 전·실패한 뒤에도 이전 회원의 상태를 보여 주지 않는다.
 * 승인 불명 요청의 requestId·answer는 메모리에만 있어 새로고침이나 언마운트 뒤에는 사라진다(복구 방식은 화면 연동 때 검토).
 */
export function useWelcomeQuest(memberId) {
  // 조회 결과에 요청한 회원을 함께 담는다. 공용 useAsync는 의존성이 바뀌어도 이전 결과를 지우지 않기 때문이다.
  const { data: loaded, loading, error, reload, setData } = useAsync(
    () => getWelcomeQuest().then((result) => ({ owner: memberId, quest: result })),
    [memberId],
    { enabled: memberId != null, fallbackMessage: '웰컴 퀘스트를 불러오지 못했습니다.' },
  )
  // 지급 요청 중인 { memberId, step } 목록. 현재 회원의 것만 claimingSteps로 보여 준다.
  const [claiming, setClaiming] = useState([])
  // 회원·단계별 지급 시도({ requestId, answer }). 승인 여부가 불확실한 실패 뒤의 재시도가 같은 ID와 같은 본문을 쓰도록 보관한다.
  const attempts = useRef(new Map())
  // 같은 틱에 연달아 눌러도 한 번만 보내기 위한 진행 중 키(state는 다음 렌더에야 바뀐다).
  const inFlight = useRef(new Set())

  /** 지급을 요청한 회원의 조회 상태일 때만 단계를 CLAIMED로 표시한다. 저장된 조회 결과가 다른 회원의 것이면 건드리지 않는다. */
  const markClaimed = useCallback((owner, step) => {
    setData((current) => (
      current?.owner === owner ? { ...current, quest: markStepClaimed(current.quest, step) } : current
    ))
  }, [setData])

  /** 단계 보상 지급을 요청하고 결과에 따라 상태와 requestId를 정리한다. */
  const claim = useCallback(async (step, { answer } = {}) => {
    const key = `${memberId}:${step}`
    if (inFlight.current.has(key)) return null
    inFlight.current.add(key)
    setClaiming((current) => [...current, { memberId, step }])
    // 불확실한 실패 뒤의 재시도라면 앞선 시도(requestId와 answer)를 그대로 쓴다. 새 시도는 새 ID와 지금 받은 answer를 쓴다.
    const attempt = attempts.current.get(key) ?? { requestId: newRequestId(), answer }
    attempts.current.set(key, attempt)
    try {
      const result = await claimWelcomeQuestStep(step, attempt)
      attempts.current.delete(key)
      markClaimed(memberId, step)
      return result
    } catch (claimError) {
      const code = claimError instanceof ApiError ? claimError.code : null
      if (!keepsRequestId(claimError)) attempts.current.delete(key)
      // 다른 요청으로 이미 지급된 단계라면 지급은 끝난 것이므로 실패로 보여 주지 않고 완료로 맞춘다.
      if (code === 'WELCOME_QUEST_ALREADY_CLAIMED') {
        markClaimed(memberId, step)
        return { step, status: 'CLAIMED', alreadyClaimed: true }
      }
      throw claimError
    } finally {
      inFlight.current.delete(key)
      // 끝난 이 요청만 목록에서 뺀다. 다른 단계의 진행 표시는 그대로 둔다.
      setClaiming((current) => {
        const index = current.findIndex((item) => item.memberId === memberId && item.step === step)
        return index < 0 ? current : current.filter((_, position) => position !== index)
      })
    }
  }, [memberId, markClaimed])

  // 지금 회원이 요청해 받은 결과만 보여 준다. 계정이 바뀐 직후나 새 조회가 실패한 뒤에도 이전 회원의 상태는 숨긴다.
  const quest = memberId != null && loaded?.owner === memberId ? loaded.quest : null
  const claimingSteps = claiming.filter((item) => item.memberId === memberId).map((item) => item.step)

  return { quest, loading, error, reload, claim, claimingSteps }
}
