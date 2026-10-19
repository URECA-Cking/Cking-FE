import { useRef, useState } from 'react'
import { ErrorBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { useMyTickets } from '../../context/useMyTickets.js'
import { ApiError, describeError, newRequestId } from '../../api/client.js'
import { completeCommonMission, getCommonMissions } from '../../api/missions.js'
import { getCommonTicketHistorySince } from '../../api/tickets.js'
import { buildStampSlots } from '../../utils/attendanceStamps.js'
import { keepsRequestId } from '../../utils/earnRetry.js'

const MISSION_LABELS = { ATTENDANCE: '출석체크' }

// 출석 도장은 최근 7일(UTC 날짜 기준 경계 하루 여유 포함)의 출석 적립이 필요하다.
const STAMP_WINDOW_MS = 8 * 24 * 60 * 60 * 1000

/**
 * 출석 도장 칸 하나의 배경·테두리·글자 스타일을 정한다.
 * 아직 안 찍은 칸은 입체 그림자가 있는 3D 캡슐, 찍은 칸은 연한 핑크 채움이다.
 * 오늘 찍을 칸은 링으로 강조하고, 마지막 칸은 모드별 대비를 맞춘 보상 색(warm-accent)으로 구분한다.
 */
function stampTileClass(slot, isLast) {
  const base = 'flex flex-col items-center rounded-2xl border-2 py-2.5'
  if (slot.stamped) return `${base} border-primary/40 bg-primary/15 text-primary`
  if (slot.next) return `${base} -translate-y-0.5 border-transparent bg-primary/15 text-primary shadow-md shadow-primary/20 ring-2 ring-primary`
  if (isLast) return `${base} border-warm-accent bg-warm-accent/15 text-warm-accent shadow-[0_4px_0_rgb(var(--color-warm-accent)/0.55)]`
  return `${base} border-on-surface/15 bg-on-surface/5 text-outline shadow-[0_4px_0_rgb(var(--color-on-surface)/0.15)]`
}

const SPARK_ANGLES = [0, 60, 120, 180, 240, 300]

/** 도장이 찍히는 순간 칸 둘레에 퍼지는 고리와 반짝이. 장식이라 스크린리더에서는 숨긴다. */
function StampBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="stamp-ring absolute h-9 w-9 rounded-full border-2 border-primary" />
      {SPARK_ANGLES.map((angle) => (
        <span key={angle} className="stamp-spark absolute h-1.5 w-1.5 rounded-full bg-warm-accent" style={{ '--a': `${angle}deg` }} />
      ))}
    </span>
  )
}

/**
 * 홈의 공용 미션(출석). 크리에이터별 미션은 N회 호출이라 크리에이터 스페이스에서 한다.
 * welcomeBonus({ status, claiming, onClaim })가 있고 받을 수 있는 상태(CLAIMABLE)면 별도 상자 없이,
 * 도장 찍기를 누를 때 오늘 도장 다음 칸(신규 회원은 DAY 2)이 웰컴 보너스로 이어서 찍힌다.
 */
export default function MissionSection({ memberId, welcomeBonus = null }) {
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
  // 이번 화면에서 웰컴 보너스를 받았는지. 서버 상태는 곧 CLAIMED로 바뀌지만, 받은 결과를 바로 보여 주기 위해 따로 둔다.
  const [bonusReceived, setBonusReceived] = useState(false)
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
      return true
    } catch (completeError) {
      const code = completeError instanceof ApiError ? completeError.code : null
      if (code === 'DUPLICATE_MISSION') {
        requestIds.current.delete(mission.missionId)
        markCompleted(mission.missionId)
        showToast('오늘은 이미 완료했어요.')
        return true
      }
      // ApiError가 아닌 예외, 코드 없는 응답, 5xx도 서버 처리 여부를 알 수 없어 키를 유지한다. 서버가 처리하지 않았다고 알린 확정 실패만 키를 버린다.
      if (!keepsRequestId(completeError)) requestIds.current.delete(mission.missionId)
      showToast(describeError(completeError, '미션을 완료하지 못했어요. 다시 눌러 주세요.'), { icon: 'error' })
      return false
    } finally {
      setBusyId(null)
    }
  }

  /**
   * 출석 도장을 먼저 찍고, 받을 보너스가 있으면 이어서 다음 칸에 보너스 도장을 찍는다.
   * 보너스가 출석보다 먼저 찍히지 않게 하고, 신규 회원이 한 번만 눌러도 둘 다 찍히게 한다. 출석이 실패하면 보너스는 받지 않는다.
   */
  async function completeThenBonus(mission, { alreadyDone }) {
    if (!alreadyDone && !(await complete(mission))) return
    if (bonusPending) {
      // 출석 도장 효과가 끝난 뒤에 보너스 도장이 찍히도록 잠깐 둔다.
      if (!alreadyDone) await new Promise((resolve) => setTimeout(resolve, 650))
      await claimBonus()
    }
  }

  /** 웰컴 보너스 지급을 요청하고, 지급되면 받은 상태로 표시한다. */
  async function claimBonus() {
    const outcome = await welcomeBonus.onClaim()
    if (outcome?.status === 'claimed') setBonusReceived(true)
  }

  const bonusVisible = (welcomeBonus != null && (welcomeBonus.status === 'CLAIMABLE' || bonusReceived))
  // 아직 받지 않은 웰컴 보너스가 남아 있는지. 있으면 도장 찍기가 보너스 도장까지 이어서 찍는다.
  const bonusPending = bonusVisible && !bonusReceived

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
        const baseStamps = mission.type === 'ATTENDANCE'
          ? buildStampSlots({
              ledgerItems: stampsReady ? ledger.items : [],
              missionId: mission.missionId,
              completedToday: stampsReady && done,
            }).map((slot) => (stampsReady ? slot : { ...slot, next: false }))
          : null
        // 웰컴 보너스는 별도 칸이 아니라 출석 도장 다음 칸에 도장 하나가 더 찍힌 것으로 보여 준다.
        const attendedCount = baseStamps ? baseStamps.filter((slot) => slot.stamped).length : 0
        const stampedCount = baseStamps ? Math.min(attendedCount + (bonusReceived ? 1 : 0), baseStamps.length) : 0
        const stamps = baseStamps ? baseStamps.map((slot, index) => ({ ...slot, stamped: index < stampedCount })) : null
        // 방금 찍힌 도장(가장 오른쪽에 찍힌 칸)에만 찍힘 효과를 준다.
        const isJustStamped = (index) => justStamped && index === stampedCount - 1
        // 도장 찍기 버튼뿐 아니라 도장 칸을 눌러도 같은 동작을 한다. 이미 처리 중이거나 더 할 게 없으면 누를 수 없다.
        const stampable = !busy && (!done || bonusPending)
        const stampButtonLabel = busy ? '처리 중' : done ? (bonusPending ? '보너스 받기' : '출석 완료') : '도장 찍기'
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
                disabled={(done && !bonusPending) || busy}
                onClick={() => completeThenBonus(mission, { alreadyDone: done })}
                className="shrink-0 whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 font-label-sm text-label-sm text-on-primary disabled:bg-on-surface/10 disabled:text-outline active:opacity-70 transition-opacity"
              >
                {stampButtonLabel}
              </button>
            </div>
            {stamps && (
              <>
                <ol
                  className={`mt-3 grid grid-cols-7 gap-1.5 text-center ${stampable ? 'cursor-pointer' : ''}`}
                  aria-label="최근 7일 출석 도장"
                  onClick={stampable ? () => completeThenBonus(mission, { alreadyDone: done }) : undefined}
                >
                  {stamps.map((slot, index) => (
                    <li
                      key={index}
                      aria-label={`${index + 1}번째 도장 ${slot.stamped ? '찍힘' : '비어 있음'}`}
                      aria-current={slot.next ? 'step' : undefined}
                      className={`relative ${stampTileClass(slot, index === stamps.length - 1)} ${
                        slot.stamped && isJustStamped(index) ? 'animate-stamp-bounce' : ''
                      }`}
                    >
                      {slot.stamped && isJustStamped(index) && <StampBurst />}
                      <span className="text-[10px] font-bold opacity-80">DAY {index + 1}</span>
                      <span className={`my-0.5 flex h-[22px] items-center ${slot.stamped && isJustStamped(index) ? 'animate-stamp-pop' : ''}`}>
                        {slot.stamped ? (
                          <span aria-hidden="true" className="text-[18px] leading-none">💮</span>
                        ) : (
                          <span aria-hidden="true" className="material-symbols-rounded text-[20px]">{index === stamps.length - 1 ? 'emoji_events' : 'star'}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-extrabold">+{mission.rewardAmount}장</span>
                    </li>
                  ))}
                </ol>
                {bonusVisible && (
                  <p className={`mt-2 text-center font-label-sm text-label-sm font-bold ${bonusReceived ? 'text-success-text' : 'text-warm-accent'}`}>
                    {bonusReceived ? '웰컴 보너스 응모권 +1장이 지급되었어요!' : '도장을 찍으면 웰컴 보너스 응모권 +1장도 함께 받아요!'}
                  </p>
                )}
                {stampsReady ? (
                  <p className="mt-2 text-center font-label-xs text-label-xs text-on-surface-variant font-normal">
                    최근 7일 중 {attendedCount}일 출석 · 매일 오전 9시에 초기화돼요
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
