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
import { keepsRequestId } from '../../utils/earnRetry.js'

const MISSION_LABELS = { ATTENDANCE: '출석체크' }

// 출석 도장은 최근 7일(UTC 날짜 기준 경계 하루 여유 포함)의 출석 적립이 필요하다.
const STAMP_WINDOW_MS = 8 * 24 * 60 * 60 * 1000

/** 도장 칸 자리에 놓는 웰컴 보너스 상자. 받기 전에는 눌러서 지급을 요청하고, 받은 뒤에는 체크가 채워진 칸으로 바뀐다. */
function WelcomeBonusSlot({ received, claiming, onClaim }) {
  if (received) {
    return (
      <li aria-label="웰컴 보너스 받음" className="flex flex-col items-center rounded-2xl bg-primary py-2.5 text-on-primary shadow-sm shadow-primary/30">
        <span className="whitespace-nowrap text-[10px] font-bold opacity-80">선물</span>
        <span className="my-0.5 flex h-[22px] items-center"><FilledCheck size={18} tone="onPrimary" /></span>
        <span className="text-[10px] font-extrabold">+1장</span>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        aria-label="웰컴 보너스 상자 열기"
        disabled={claiming}
        onClick={onClaim}
        className="flex w-full animate-pulse flex-col items-center rounded-2xl border-2 border-dashed border-warm-accent bg-warm-accent/10 py-2.5 text-warm-accent disabled:opacity-60"
      >
        <span className="whitespace-nowrap text-[10px] font-bold">선물</span>
        <span aria-hidden="true" className="material-symbols-rounded my-0.5 text-[18px]">redeem</span>
        <span className="whitespace-nowrap text-[10px] font-extrabold">{claiming ? '여는 중' : '터치!'}</span>
      </button>
    </li>
  )
}

/**
 * 출석 도장 칸 하나의 배경·글자 스타일을 정한다. 채움 배경이 기본이다.
 * 찍힌 칸은 핑크로 채우고, 오늘 찍을 칸은 연한 핑크 + 링으로 강조하며, 마지막 칸은 모드별 대비를 맞춘 보상 색(warm-accent)으로 구분한다.
 */
function stampTileClass(slot, isLast) {
  const base = 'flex flex-col items-center rounded-2xl py-2.5'
  if (slot.stamped) return `${base} bg-primary text-on-primary shadow-sm shadow-primary/30`
  if (slot.next) return `${base} scale-105 bg-primary/15 text-primary shadow-md shadow-primary/20 ring-2 ring-primary`
  if (isLast) return `${base} bg-warm-accent/20 text-warm-accent`
  return `${base} bg-on-surface/10 text-outline`
}

// 웰컴 보너스 상자를 놓는 도장 칸(DAY 2). 이미 도장이 찍힌 칸이면 도장 칸 아래 줄로 옮긴다.
const BONUS_SLOT_INDEX = 1

/**
 * 홈의 공용 미션(출석). 크리에이터별 미션은 N회 호출이라 크리에이터 스페이스에서 한다.
 * welcomeBonus({ status, claiming, onClaim })가 있고 받을 수 있는 상태(CLAIMABLE)면 DAY 2 자리에 웰컴 보너스 상자를 보여준다.
 * 지급은 onClaim이 서버에 요청하고, 지급되면 이번 화면에서는 받은 상태로 남겼다가 다음에 열 때 사라진다.
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
    } catch (completeError) {
      const code = completeError instanceof ApiError ? completeError.code : null
      if (code === 'DUPLICATE_MISSION') {
        requestIds.current.delete(mission.missionId)
        markCompleted(mission.missionId)
        showToast('오늘은 이미 완료했어요.')
        return
      }
      // ApiError가 아닌 예외, 코드 없는 응답, 5xx도 서버 처리 여부를 알 수 없어 키를 유지한다. 서버가 처리하지 않았다고 알린 확정 실패만 키를 버린다.
      if (!keepsRequestId(completeError)) requestIds.current.delete(mission.missionId)
      showToast(describeError(completeError, '미션을 완료하지 못했어요. 다시 눌러 주세요.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  /** 웰컴 보너스 지급을 요청하고, 지급되면 받은 상태로 표시한다. */
  async function claimBonus() {
    const outcome = await welcomeBonus.onClaim()
    if (outcome?.status === 'claimed') setBonusReceived(true)
  }

  const bonusVisible = welcomeBonus != null && (welcomeBonus.status === 'CLAIMABLE' || bonusReceived)

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
        // 보너스 상자는 DAY 2 칸이 비어 있으면 그 자리에, 이미 도장이 찍혔으면 도장 칸 아래 줄에 둔다.
        const bonusInSlot = bonusVisible && stamps != null && !stamps[BONUS_SLOT_INDEX].stamped
        const bonusInRow = bonusVisible && stamps != null && !bonusInSlot
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
                    index === BONUS_SLOT_INDEX && bonusInSlot ? (
                      <WelcomeBonusSlot key={index} received={bonusReceived} claiming={welcomeBonus.claiming} onClaim={claimBonus} />
                    ) : (
                      <li
                        key={index}
                        aria-label={`${index + 1}번째 도장 ${slot.stamped ? '찍힘' : '비어 있음'}`}
                        aria-current={slot.next ? 'step' : undefined}
                        className={stampTileClass(slot, index === stamps.length - 1)}
                      >
                        <span className="text-[10px] font-bold opacity-80">DAY {index + 1}</span>
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
                        <span className="text-[10px] font-extrabold">+{mission.rewardAmount}장</span>
                      </li>
                    )
                  ))}
                </ol>
                {bonusInRow && !bonusReceived && (
                  <button
                    type="button"
                    disabled={welcomeBonus.claiming}
                    onClick={claimBonus}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-warm-accent bg-warm-accent/10 py-2 font-label-sm text-label-sm font-bold text-warm-accent disabled:opacity-60"
                  >
                    <span aria-hidden="true" className="material-symbols-rounded text-[18px]">redeem</span>
                    {welcomeBonus.claiming ? '여는 중...' : '웰컴 보너스 상자 열기'}
                  </button>
                )}
                {bonusVisible && (
                  <p className={`mt-2 text-center font-label-sm text-label-sm font-bold ${bonusReceived ? 'text-success-text' : 'text-warm-accent'}`}>
                    {bonusReceived ? '웰컴 보너스 응모권 +1장이 지급되었어요!' : '깜짝 웰컴 보너스 상자를 터치해서 추가 응모권을 받아보세요!'}
                  </p>
                )}
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
