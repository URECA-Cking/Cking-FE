import { useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import FilledCheck from './FilledCheck.jsx'
import { ErrorBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { useMyTickets } from '../../context/useMyTickets.js'
import { ApiError, describeError, newRequestId } from '../../api/client.js'
import { completeCommonMission, getCommonMissions } from '../../api/missions.js'
import { getCommonTicketHistorySince } from '../../api/tickets.js'
import { buildStampSlots } from '../../utils/attendanceStamps.js'

const MISSION_LABELS = { ATTENDANCE: '출석체크' }

// 결과를 모르는 실패(네트워크 끊김·타임아웃·적립 장애·점검)는 서버가 이미 적립했을 수 있어 같은 requestId로 재시도해야 한다.
const RETRY_WITH_SAME_ID = ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']

// 출석 도장은 최근 7일(UTC 날짜 기준 경계 하루 여유 포함)의 출석 적립이 필요하다.
const STAMP_WINDOW_MS = 8 * 24 * 60 * 60 * 1000

/** 홈의 공용 미션(출석). 크리에이터별 미션은 N회 호출이라 크리에이터 스페이스에서 한다. */
export default function MissionSection({ memberId }) {
  const showToast = useToast()
  const { refresh: refreshMyTickets } = useMyTickets() // 출석 적립 뒤 헤더의 총 응모권 개수를 갱신한다
  const { data: missions, loading, error, reload, setData } = useAsync(
    () => getCommonMissions(),
    [memberId],
    { enabled: memberId != null, fallbackMessage: '미션을 불러오지 못했습니다.' },
  )
  // 도장 칸은 원장의 출석 적립으로 그린다. 조회가 끝나기 전이나 실패했을 때는 출석 일수를 알 수 없으므로
  // 0일로 단정하지 않고 도장 칸을 비운 채 안내(로딩·재시도)만 보여준다.
  const { data: ledger, loading: ledgerLoading, error: ledgerError, reload: reloadLedger } = useAsync(
    () => getCommonTicketHistorySince(Date.now() - STAMP_WINDOW_MS),
    [memberId],
    { enabled: memberId != null },
  )
  const [busyId, setBusyId] = useState(null)
  const [justStamped, setJustStamped] = useState(false)
  const requestIds = useRef(new Map())

  /** 응답을 받은 미션을 오늘 완료한 상태로 표시한다. */
  const markCompleted = (missionId) => setData((current) => (
    (current ?? []).map((item) => (item.missionId === missionId ? { ...item, completedToday: true } : item))
  ))

  /** 출석 미션 완료를 요청하고, 결과에 따라 도장·안내를 갱신하며 불확실한 실패는 같은 requestId로 재시도할 수 있게 둔다. */
  async function complete(mission) {
    setBusyId(mission.missionId)
    // 사용자가 다시 누른 새 시도가 아니라 불확실한 실패의 재시도라면 앞선 requestId를 그대로 쓴다.
    const requestId = requestIds.current.get(mission.missionId) ?? newRequestId()
    requestIds.current.set(mission.missionId, requestId)
    try {
      await completeCommonMission(mission.missionId, requestId)
      requestIds.current.delete(mission.missionId)
      markCompleted(mission.missionId)
      setJustStamped(true)
      showToast(`응모권 ${mission.rewardAmount}장을 적립했어요.`)
      refreshMyTickets()
    } catch (completeError) {
      const code = completeError instanceof ApiError ? completeError.code : null
      if (code === 'DUPLICATE_MISSION') {
        requestIds.current.delete(mission.missionId)
        markCompleted(mission.missionId)
        showToast('오늘은 이미 완료했어요.')
        return
      }
      // ApiError가 아닌 예외도 서버 처리 여부를 알 수 없어 키를 유지한다. 확정된 실패(RETRY 목록 밖의 코드)만 키를 버린다.
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
    <section className="mt-6 px-margin flex flex-col gap-2.5">
      {missions.map((mission) => {
        const done = mission.completedToday
        const busy = busyId === mission.missionId
        const stampsReady = ledger != null && !ledgerError
        const stamps = mission.type === 'ATTENDANCE'
          ? buildStampSlots({
              ledgerItems: stampsReady ? ledger.items : [],
              missionId: mission.missionId,
              completedToday: stampsReady && done,
            }).map((slot) => (stampsReady ? slot : { ...slot, next: false }))
          : null
        const stampedCount = stamps ? stamps.filter((slot) => slot.stamped).length : 0
        return (
          <div key={mission.missionId} className="rounded-3xl bg-surface-container p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {stamps && <span className="rounded-md bg-primary/15 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-primary">DAILY CHECK-IN</span>}
                <p className="mt-1 font-label-md text-label-md text-on-surface line-clamp-2">
                  {MISSION_LABELS[mission.type] ?? '미션'}
                  <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant font-normal">응모권 +{mission.rewardAmount}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={done || busy}
                onClick={() => complete(mission)}
                className="shrink-0 whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 font-label-sm text-label-sm text-on-primary disabled:bg-on-surface/10 disabled:text-outline active:opacity-70 transition-opacity"
              >
                {busy ? '처리 중' : done ? '출석 완료' : '도장 찍기'}
              </button>
            </div>
            {stamps && (
              <>
                <ol className="mt-3 grid grid-cols-7 gap-1.5 text-center" aria-label="최근 7일 출석 도장">
                  {stamps.map((slot, index) => (
                    <li
                      key={index}
                      aria-label={`${index + 1}번째 도장 ${slot.stamped ? '찍힘' : '비어 있음'}`}
                      className={`flex flex-col items-center rounded-xl py-2 ${
                        slot.stamped
                          ? 'bg-primary text-on-primary shadow-sm shadow-primary/30'
                          : slot.next
                            ? 'animate-pulse border-2 border-dashed border-tertiary-container bg-tertiary-container/10 text-tertiary-container'
                            : 'bg-on-surface/5 text-outline'
                      }`}
                    >
                      <span className="text-[9px] font-bold opacity-80">DAY {index + 1}</span>
                      <span
                        className={`my-0.5 flex h-[22px] items-center ${
                          slot.stamped && justStamped && index === stampedCount - 1 ? 'animate-stamp-pop' : ''
                        }`}
                      >
                        {slot.stamped ? (
                          <FilledCheck size={18} tone="onPrimary" />
                        ) : (
                          <MaterialIcon name={index === stamps.length - 1 ? 'workspace_premium' : 'confirmation_number'} className="text-[18px]" />
                        )}
                      </span>
                      <span className="text-[9px] font-extrabold">+{mission.rewardAmount}장</span>
                    </li>
                  ))}
                </ol>
                {stampsReady ? (
                  <p className="mt-2 text-center font-label-xs text-label-xs text-on-surface-variant font-normal">
                    최근 7일 중 {stampedCount}일 출석 · 매일 오전 9시에 초기화돼요
                  </p>
                ) : ledgerError && !ledgerLoading ? (
                  <p className="mt-2 flex items-center justify-between gap-2 font-label-xs text-label-xs text-on-surface-variant font-normal">
                    <span>출석 현황을 불러오지 못했어요.</span>
                    <button type="button" onClick={reloadLedger} className="shrink-0 font-semibold text-primary underline underline-offset-2 active:opacity-70">
                      다시 시도
                    </button>
                  </p>
                ) : (
                  <p className="mt-2 text-center font-label-xs text-label-xs text-on-surface-variant font-normal">출석 현황을 불러오는 중...</p>
                )}
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
