import { useRef, useState } from 'react'
import { ErrorBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError, newRequestId } from '../../api/client.js'
import { completeCommonMission, getCommonMissions } from '../../api/missions.js'

const MISSION_LABELS = { ATTENDANCE: '출석체크' }

// 결과를 모르는 실패(타임아웃·적립 장애·점검)는 같은 requestId로 재시도해야 중복 지급이 없다.
const RETRY_WITH_SAME_ID = ['EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']

/** 홈의 공용 미션(출석). 크리에이터별 미션은 N회 호출이라 크리에이터 스페이스에서 한다. */
export default function MissionSection({ memberId }) {
  const showToast = useToast()
  const { data: missions, loading, error, reload, setData } = useAsync(
    () => getCommonMissions(),
    [memberId],
    { enabled: memberId != null, fallbackMessage: '미션을 불러오지 못했습니다.' },
  )
  const [busyId, setBusyId] = useState(null)
  const requestIds = useRef(new Map())

  const markCompleted = (missionId) => setData((current) => (
    (current ?? []).map((item) => (item.missionId === missionId ? { ...item, completedToday: true } : item))
  ))

  async function complete(mission) {
    setBusyId(mission.missionId)
    // 사용자가 다시 누른 새 시도가 아니라 불확실한 실패의 재시도라면 앞선 requestId를 그대로 쓴다.
    const requestId = requestIds.current.get(mission.missionId) ?? newRequestId()
    requestIds.current.set(mission.missionId, requestId)
    try {
      await completeCommonMission(mission.missionId, requestId)
      requestIds.current.delete(mission.missionId)
      markCompleted(mission.missionId)
      showToast(`응모권 ${mission.rewardAmount}장을 적립했어요.`)
    } catch (completeError) {
      const code = completeError instanceof ApiError ? completeError.code : null
      if (code === 'DUPLICATE_MISSION') {
        requestIds.current.delete(mission.missionId)
        markCompleted(mission.missionId)
        showToast('오늘은 이미 완료했어요.')
        return
      }
      // 코드가 없으면 네트워크 오류라 서버 처리 여부를 알 수 없다.
      if (code !== null && !RETRY_WITH_SAME_ID.includes(code)) requestIds.current.delete(mission.missionId)
      showToast(describeError(completeError, '미션을 완료하지 못했어요. 다시 눌러 주세요.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  // 한 줄 구조라 로딩 중에는 자리를 비워 두고, 미션이 없으면 섹션 자체를 그리지 않는다.
  if (loading) return null
  if (error) return <div className="mt-6 px-margin"><ErrorBlock message={error} onRetry={reload} /></div>
  if ((missions ?? []).length === 0) return null

  return (
    <section className="mt-6 px-margin">
      {missions.map((mission) => {
        const done = mission.completedToday
        const busy = busyId === mission.missionId
        return (
          <div
            key={mission.missionId}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-primary to-berry-deep"
          >
            <p className="min-w-0 font-label-md text-label-md text-on-primary line-clamp-2">
              {MISSION_LABELS[mission.type] ?? '미션'}
              <span className="ml-2 font-label-sm text-label-sm text-on-primary/80 font-normal">응모권 +{mission.rewardAmount}</span>
            </p>
            <button
              type="button"
              disabled={done || busy}
              onClick={() => complete(mission)}
              className="shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 font-label-sm text-label-sm text-primary disabled:bg-white/25 disabled:text-on-primary/80 active:opacity-70 transition-opacity"
            >
              {busy ? '처리 중' : done ? '도장 완료' : '도장 찍기'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
