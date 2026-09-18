import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import BottomSheet from '../components/ui/BottomSheet.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { getEventById } from '../data/events.js'
import { getCreatorById } from '../data/creators.js'
import { useToast } from '../context/ToastContext.jsx'

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()

  const event = getEventById(eventId)
  const creator = event ? getCreatorById(event.creatorId) : null

  const [totalTickets, setTotalTickets] = useState(creator?.tickets ?? 0)
  const [selectedCount, setSelectedCount] = useState(Math.min(3, creator?.tickets ?? 1) || 1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | submitting | done

  const oddsRank = useMemo(() => Math.max(1, Math.round(15 - selectedCount * 1.5)), [selectedCount])
  const oddsProgress = totalTickets > 0 ? Math.min(100, Math.round((selectedCount / totalTickets) * 100)) : 0

  if (!event || !creator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-margin text-center">
        <p className="font-title-md text-title-md text-on-surface">이벤트를 찾을 수 없어요.</p>
        <Link to="/" className="text-primary font-label-md text-label-md font-semibold">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  function adjust(delta) {
    setSelectedCount((prev) => Math.min(totalTickets, Math.max(1, prev + delta)))
  }

  function quickAdd(amount) {
    setSelectedCount((prev) => Math.min(totalTickets, prev + amount))
  }

  function openConfirm() {
    if (totalTickets === 0) {
      showToast('보유한 응모권이 없어요. 미션을 완료하고 응모권을 모아보세요!')
      return
    }
    setStatus('idle')
    setSheetOpen(true)
  }

  function submitEntry() {
    setStatus('submitting')
    setTimeout(() => {
      setStatus('done')
      setTotalTickets((prev) => prev - selectedCount)
      showToast(`축하합니다! ${selectedCount}장의 응모권이 정상 투입되었습니다.`)
      setTimeout(() => {
        setSheetOpen(false)
        setSelectedCount(Math.min(1, Math.max(0, totalTickets - selectedCount)) || 1)
      }, 900)
    }, 1600)
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title="Raffle Detail" onBack={() => navigate(-1)} />
      <div className="pt-14 flex flex-col w-full">
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
          <img className="w-full h-full object-cover" src={event.banner} alt={event.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-surface/90 via-slate-surface/20 to-transparent" />
          <div className="absolute top-space-md left-space-md flex flex-wrap items-center gap-space-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-on-primary font-label-xs text-label-xs shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              진행 중 {event.dDay}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-glass backdrop-blur-md text-on-surface font-label-xs text-label-xs shadow-sm">
              {event.quotaLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-xs text-label-xs shadow-sm">
              <MaterialIcon name="stars" filled className="text-[13px]" />
              {event.entryTier}
            </span>
          </div>
          <div className="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between text-white">
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="verified" className="text-berry-glow text-[18px]" />
              <span className="font-label-sm text-label-sm tracking-wide text-white/95">공식 아티스트 래플 이벤트</span>
            </div>
            <div className="flex items-center gap-1 bg-surface-glass-dark px-2 py-0.5 rounded-full backdrop-blur-md text-white/90 font-label-xs text-label-xs">
              <MaterialIcon name="local_activity" className="text-[14px]" />
              <span>실시간 응모 {event.applied.toLocaleString()}건</span>
            </div>
          </div>
        </div>

        <div className="px-space-md pt-space-lg flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-1.5 text-primary">
              <span className="font-title-md text-title-md font-bold text-on-surface">{creator.name}</span>
              <MaterialIcon name="verified" filled className="text-primary text-[18px]" />
              <span className="px-1.5 py-0.5 rounded bg-berry-tint text-berry-deep font-label-xs text-label-xs font-semibold">
                공식 파트너
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md font-extrabold text-on-surface tracking-tight">
              {event.subtitle}
            </h2>
            <div className="flex items-center gap-1.5 text-slate-muted font-body-sm text-body-sm pt-0.5">
              <MaterialIcon name="event" className="text-primary text-[17px]" />
              <span>{event.date}</span>
              <span className="text-outline-variant">•</span>
              <span>{event.place}</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant pt-1 leading-relaxed">
              {event.description}
            </p>
            <div className="mt-space-xs flex items-center gap-2 p-3 rounded-xl bg-surface-container-low text-on-surface-variant">
              <MaterialIcon name="info" className="text-secondary text-[20px] shrink-0" />
              <span className="font-body-sm text-body-sm leading-snug">
                사용한 응모권이 많을수록 당첨 확률이 높아져요.{' '}
                <span className="text-on-surface font-semibold">(조작 없는 공정 난수 추첨)</span>
              </span>
            </div>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-berry-tint flex items-center justify-center text-primary">
                <MaterialIcon name="confirmation_number" className="text-[26px]" />
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">내 보유 {creator.name} 응모권</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-metric-display text-metric-display font-extrabold text-on-surface">
                    {totalTickets}
                  </span>
                  <span className="font-label-md text-label-md font-bold text-primary">장</span>
                </div>
              </div>
            </div>
            <Link
              to={`/creators/${creator.id}`}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-berry-tint text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 shadow-sm"
            >
              <MaterialIcon name="add_circle" className="text-[18px]" />
              <span className="font-label-sm text-label-sm font-bold">응모권 더 받기</span>
            </Link>
          </div>

          {totalTickets > 0 && (
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-md flex flex-col gap-space-lg relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-title-lg text-title-lg font-bold text-on-surface">사용할 응모권 수</h3>
                </div>
                <span className="font-label-xs text-label-xs px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                  단위: 1장
                </span>
              </div>
              <div className="flex items-center justify-between bg-surface-container-low rounded-2xl p-2.5">
                <button
                  type="button"
                  aria-label="응모권 1장 감소"
                  disabled={selectedCount <= 1}
                  onClick={() => adjust(-1)}
                  className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface active:scale-90 transition-transform shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                >
                  <MaterialIcon name="remove" className="text-[26px]" />
                </button>
                <div className="flex flex-col items-center justify-center px-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-xl text-headline-xl font-extrabold text-primary tracking-tight">
                      {selectedCount}
                    </span>
                    <span className="font-title-md text-title-md font-bold text-primary">장</span>
                  </div>
                  <span className="font-label-xs text-label-xs text-slate-muted">선택 수량</span>
                </div>
                <button
                  type="button"
                  aria-label="응모권 1장 증가"
                  disabled={selectedCount >= totalTickets}
                  onClick={() => adjust(1)}
                  className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary active:scale-90 transition-transform shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                >
                  <MaterialIcon name="add" className="text-[26px]" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => quickAdd(1)} className="py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label-md text-label-md font-semibold active:scale-95 hover:bg-berry-tint hover:text-primary transition-all text-center">
                  +1장
                </button>
                <button type="button" onClick={() => quickAdd(5)} className="py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label-md text-label-md font-semibold active:scale-95 hover:bg-berry-tint hover:text-primary transition-all text-center">
                  +5장
                </button>
                <button type="button" onClick={() => setSelectedCount(totalTickets)} className="py-2.5 rounded-xl bg-primary/10 text-primary font-label-md text-label-md font-bold active:scale-95 hover:bg-primary hover:text-on-primary transition-all text-center">
                  전부 ({totalTickets}장)
                </button>
              </div>
              <div className="p-4 rounded-xl bg-surface-rose-muted flex flex-col gap-3">
                <div className="flex items-center justify-between text-on-surface">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">응모 후 잔여 응모권</span>
                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                    <span className="text-slate-muted">보유 {totalTickets}장</span>
                    <MaterialIcon name="arrow_forward" className="text-[14px] text-outline" />
                    <span className="font-bold text-primary">{totalTickets - selectedCount}장 남음</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between font-label-sm text-label-sm">
                    <span className="flex items-center gap-1 text-on-surface font-semibold">
                      <MaterialIcon name="trending_up" className="text-[16px] text-secondary" />
                      예상 당첨 지분
                    </span>
                    <span className="font-bold text-secondary">상위 {oddsRank}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-300"
                      style={{ width: `${oddsProgress}%` }}
                    />
                  </div>
                  <p className="font-label-xs text-label-xs text-slate-muted text-right">동일 회차 누적 기준 계산치</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1 text-slate-muted">
                <MaterialIcon name="priority_high" className="text-[16px] text-outline shrink-0 mt-0.5" />
                <p className="font-label-xs text-label-xs leading-normal">
                  안내: 사용한 응모권은 응모 완료 후 취소 및 환불할 수 없으며, 이벤트 종료 후 당첨자는 푸시 및 카카오톡 알림톡으로 개별 고지됩니다.
                </p>
              </div>
            </div>
          )}

          <div className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-3">
            <span className="font-title-md text-title-md font-bold text-on-surface">응모 상세 혜택</span>
            <div className="grid grid-cols-2 gap-2.5">
              {event.perks.map((perk) => (
                <div key={perk.title} className="p-3 rounded-xl bg-surface-container-lowest flex flex-col gap-1 shadow-sm">
                  <MaterialIcon name={perk.icon} className="text-primary text-[22px]" />
                  <span className="font-label-md text-label-md font-bold text-on-surface">{perk.title}</span>
                  <span className="font-label-xs text-label-xs text-slate-muted">{perk.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 bg-surface-glass backdrop-blur-2xl px-space-md pt-3 pb-6 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={openConfirm}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary via-primary-container to-berry-glow text-on-primary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            <MaterialIcon name="confirmation_number" filled className="text-[20px]" />
            <span>🎟️ {selectedCount}장으로 응모하기</span>
          </button>
          <p className="text-center font-label-xs text-label-xs text-slate-muted">당첨 발표는 인앱 알림으로 개별 안내됩니다.</p>
        </div>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={status === 'submitting' ? undefined : () => setSheetOpen(false)}
        eyebrow="Raffle Confirmation"
        title="응모 확인"
      >
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 mb-space-md">
          아래 내용으로 응모를 완료할까요?
        </p>

        <div className="p-space-sm bg-surface-rose-muted rounded-xl flex items-center gap-space-md mb-space-md shadow-sm">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
            <img className="w-full h-full object-cover" src={event.banner} alt="" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-label-sm text-label-sm text-primary font-bold tracking-tight">{creator.name}</span>
              <MaterialIcon name="verified" filled className="text-[15px] text-primary" />
              <span className="font-label-xs text-label-xs text-slate-muted ml-auto">{event.dDay}</span>
            </div>
            <h3 className="font-title-md text-title-md text-on-surface font-bold truncate mt-0.5">{event.title}</h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{event.subtitle}</p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl p-space-md mb-space-md flex flex-col gap-space-sm">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
            <div className="flex items-center gap-space-xs">
              <div className="w-7 h-7 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
                <MaterialIcon name="confirmation_number" className="text-[16px]" />
              </div>
              <span className="font-title-md text-title-md text-on-surface font-semibold">사용할 응모권</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-metric-display text-metric-display text-primary-container font-extrabold tracking-tight">
                {selectedCount}
              </span>
              <span className="font-label-md text-label-md text-primary-container font-bold">장 소모</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-body-sm text-body-sm text-on-surface-variant">현재 보유 수량</span>
            <span className="font-label-md text-label-md text-on-surface font-medium">{totalTickets}장</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">응모 후 잔여 수량</span>
            <span className="font-label-md text-label-md text-slate-muted font-bold">{totalTickets - selectedCount}장</span>
          </div>
        </div>

        <div className="bg-gold-badge-bg rounded-xl p-space-md mb-space-lg flex items-start gap-space-sm">
          <MaterialIcon name="warning" className="text-[20px] text-gold-badge flex-shrink-0 mt-0.5" />
          <p className="font-body-sm text-body-sm text-tertiary-container leading-relaxed">
            응모 완료 시 사용된 응모권은 취소 또는 환불이 불가하며, 이벤트 종료 후 공정 난수 추첨 알고리즘을 통해 투명하게 선정됩니다.
          </p>
        </div>

        {status === 'idle' && (
          <div className="grid grid-cols-5 gap-space-sm">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="col-span-2 h-12 rounded-xl bg-berry-tint text-berry-deep font-label-md text-label-md font-bold flex items-center justify-center hover:bg-border-rose active:scale-[0.98] transition-all"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitEntry}
              className="col-span-3 h-12 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-md flex items-center justify-center gap-space-xs hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <span>최종 응모하기</span>
              <span className="bg-berry-deep/40 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-white">
                {selectedCount}장 소모
              </span>
            </button>
          </div>
        )}

        {status !== 'idle' && (
          <div className={`w-full rounded-xl p-space-md flex items-center gap-space-md ${status === 'done' ? 'bg-berry-tint' : 'bg-surface-container-high'}`}>
            {status === 'submitting' ? (
              <svg className="animate-spin w-6 h-6 text-primary shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
              </svg>
            ) : (
              <MaterialIcon name="check_circle" filled className="text-primary text-[24px] shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-label-sm text-on-surface font-bold">
                {status === 'submitting' ? '응모 처리 중...' : '응모가 정상 완료되었습니다!'}
              </span>
              <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
                {status === 'submitting' ? '중복 입력을 방지하기 위해 잠시만 기다려주세요' : '결과는 인앱 알림으로 확인할 수 있어요'}
              </p>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
