import { useCallback } from 'react'
import { describeError } from '../api/client.js'
import { useToast } from '../context/useToast.js'
import { useMyTickets } from '../context/useMyTickets.js'
import { claimFailureMessage } from '../utils/welcomeQuest.js'

/**
 * 웰컴 퀘스트 지급(claim)에 화면 안내를 붙인다: 성공 토스트, 헤더 응모권 갱신, 실패 안내.
 * 훅이 던지는 오류를 화면이 바로 쓸 수 있는 결과로 바꿔, 컴포넌트가 오류 코드를 직접 다루지 않게 한다.
 * 적립은 Redis에서 먼저 승인되고 DB 반영이 비동기라 헤더 숫자를 단정하지 않고 기존 갱신(refresh)에 맡긴다.
 * @param claim useWelcomeQuest가 돌려준 claim 함수
 * @returns 단계와 옵션({ answer })으로 호출하는 함수. 결과는 { status: 'claimed' | 'confirming' | 'busy' | 'wrong' | 'failed', message? }다.
 *   confirming은 같은 단계가 다른 요청으로 이미 처리 중이거나 처리된 경우로, 서버 상태를 다시 읽는 중이라 받은 것으로 단정하지 않는다.
 */
export function useWelcomeClaim(claim) {
  const showToast = useToast()
  const { refresh: refreshMyTickets } = useMyTickets()

  return useCallback(async (step, options) => {
    try {
      const result = await claim(step, options)
      // 같은 단계가 이미 진행 중이라 요청하지 않았다. 안내 없이 끝낸다.
      if (result === null) return { status: 'busy' }
      if (result.alreadyClaimed) {
        // 다른 요청으로 이미 처리 중이거나 처리된 단계다. 훅이 서버 상태를 다시 읽으므로 결과는 곧 화면에 반영된다.
        showToast('이미 처리된 요청이에요. 상태를 다시 확인할게요.')
        return { status: 'confirming' }
      }
      showToast(`응모권 ${result.rewardAmount ?? 1}장을 받았어요.`)
      refreshMyTickets()
      return { status: 'claimed' }
    } catch (error) {
      const message = claimFailureMessage(error?.code)
      // 오답은 토스트가 아니라 퀴즈 카드 안에서 안내하므로 문구만 돌려준다.
      if (error?.code === 'WELCOME_QUEST_WRONG_ANSWER') return { status: 'wrong', message }
      showToast(message ?? describeError(error, '응모권을 받지 못했어요. 다시 눌러 주세요.'), { icon: 'error' })
      return { status: 'failed', message }
    }
  }, [claim, showToast, refreshMyTickets])
}
