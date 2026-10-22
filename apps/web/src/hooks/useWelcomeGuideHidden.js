import { useCallback, useState } from 'react'
import { readGuideHidden, writeGuideHidden } from '../utils/welcomeGuide.js'

/**
 * 시작 가이드를 닫았는지(숨김) 보여주는 훅. 값은 회원별로 브라우저 저장소에 남아 새로고침 뒤에도 유지된다.
 * 저장소를 못 써도 이번 화면에서는 바뀐 상태를 그대로 따른다.
 * @returns {[boolean, (hidden: boolean) => void]} [숨김 여부, 숨김 여부 설정 함수]
 */
export function useWelcomeGuideHidden(memberId) {
  // 이번 화면에서 바꾼 값(회원별). 없으면 저장소 값을 읽는다.
  const [changed, setChanged] = useState({})
  const hidden = memberId in changed ? changed[memberId] : readGuideHidden(memberId)

  /** 숨김 여부를 바꾸고 저장한다. */
  const setHidden = useCallback((next) => {
    writeGuideHidden(memberId, next)
    setChanged((current) => ({ ...current, [memberId]: next }))
  }, [memberId])

  return [hidden, setHidden]
}
