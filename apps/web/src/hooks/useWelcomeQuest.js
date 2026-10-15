import { useCallback, useRef, useState } from 'react'
import { useAsync } from './useAsync.js'
import { ApiError, newRequestId } from '../api/client.js'
import { claimWelcomeQuestStep, getWelcomeQuest } from '../api/welcomeQuest.js'
import { keepsRequestId } from '../utils/earnRetry.js'
import { markStepClaimed } from '../utils/welcomeQuest.js'

/**
 * 웰컴 퀘스트 상태 조회와 단계별 지급 요청을 묶은 훅. 화면은 이 훅의 상태와 claim만 사용한다.
 * - quest: 서버 상태({ eligible, completed, items, bonus }). 불러오기 전에는 null이다.
 * - claim(step, { answer }): 지급을 요청한다. 성공하면 해당 단계를 CLAIMED로 맞추고, 실패하면 ApiError를 던진다.
 * - claimingStep: 지급 요청 중인 단계. 같은 단계의 중복 요청을 막는 데 쓴다.
 */
export function useWelcomeQuest(memberId) {
  const { data: quest, loading, error, reload, setData } = useAsync(
    () => getWelcomeQuest(),
    [memberId],
    { enabled: memberId != null, fallbackMessage: '웰컴 퀘스트를 불러오지 못했습니다.' },
  )
  const [claimingStep, setClaimingStep] = useState(null)
  // 단계별 requestId. 승인 여부가 불확실한 실패 뒤의 재시도가 같은 ID를 쓰도록 보관한다.
  const requestIds = useRef(new Map())
  // 같은 틱에 연달아 눌러도 한 번만 보내기 위한 진행 중 단계(state는 다음 렌더에야 바뀐다).
  const inFlight = useRef(new Set())

  /** 단계를 CLAIMED로 표시한다. 상태가 없으면 아무것도 하지 않는다. */
  const markClaimed = useCallback((step) => setData((current) => markStepClaimed(current, step)), [setData])

  /** 단계 보상 지급을 요청하고 결과에 따라 상태와 requestId를 정리한다. */
  const claim = useCallback(async (step, { answer } = {}) => {
    if (inFlight.current.has(step)) return null
    inFlight.current.add(step)
    setClaimingStep(step)
    // 불확실한 실패 뒤의 재시도라면 앞선 requestId를 그대로 쓴다. 새 시도는 새 ID를 만든다.
    const requestId = requestIds.current.get(step) ?? newRequestId()
    requestIds.current.set(step, requestId)
    try {
      const result = await claimWelcomeQuestStep(step, { requestId, answer })
      requestIds.current.delete(step)
      markClaimed(step)
      return result
    } catch (claimError) {
      const code = claimError instanceof ApiError ? claimError.code : null
      if (!keepsRequestId(code)) requestIds.current.delete(step)
      // 다른 요청으로 이미 지급된 단계라면 지급은 끝난 것이므로 실패로 보여 주지 않고 완료로 맞춘다.
      if (code === 'WELCOME_QUEST_ALREADY_CLAIMED') {
        markClaimed(step)
        return { step, status: 'CLAIMED', alreadyClaimed: true }
      }
      throw claimError
    } finally {
      inFlight.current.delete(step)
      setClaimingStep(null)
    }
  }, [markClaimed])

  return { quest, loading, error, reload, claim, claimingStep }
}
