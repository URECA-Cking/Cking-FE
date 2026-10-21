import CreatorVerifiedBadge from '../ui/CreatorVerifiedBadge.jsx'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { getEventBanner } from '../../data/eventBanners.js'
import { useCreatorProfile } from '../../hooks/useCreatorProfile.js'
import { useNow } from '../../hooks/useNow.js'
import { formatCountdown, formatDday, formatEventDate, formatNumber, formatShortDate, totalPrizeQuantity } from '../../utils/format.js'
import { displayStatusMeta, eventStatusMeta } from '../../utils/eventStatus.js'

/**
 * 이벤트(래플) 요약 카드. 백엔드 EventSummary( eventId, creatorId, title, startAt,
 * endAt, status, displayStatus, winnerCount, drawMethod, prizes )를 그대로 받는다.
 *
 * 응모 누적 건수는 공개 API가 제공하지 않아, 대신 실제 값이 있는 당첨 인원과
 * 상품 등급 구성을 보여준다.
 *
 * 내 스페이스에서는 크리에이터 본인 목록의 이벤트를 같은 카드로 보여준다. 표시 상태(displayStatus)가 없으면
 * 아직 공개되지 않은 이벤트(초안·승인 대기·거절됨)라 상태 뱃지와 거절 사유를 보여주고 상세로 가지 않는다.
 * onManage를 주면 카드 왼쪽 위에 관리 메뉴(⋯) 버튼이 생긴다.
 * priority는 화면에 처음 보이는 카드용이다. 배너를 lazy 없이 높은 우선순위로 바로 받아, 스페이스에 들어오자마자 보이게 한다.
 */
export default function EventCard({ event, showCreatorTag = false, variant = 'carousel', onManage, priority = false }) {
  const navigate = useNavigate()
  const creator = useCreatorProfile(event.creatorId)
  const published = Boolean(event.displayStatus)
  const status = published ? displayStatusMeta(event.displayStatus) : eventStatusMeta(event.status)
  const closed = event.displayStatus === 'CLOSED'
  const dday = formatDday(event.endAt, { closed })
  const urgent = published && !closed && (dday === 'D-DAY' || dday === 'D-1')
  // D-day 숫자를 보여줄 때는 상태 아이콘(번개) 없이 글자만 쓴다. 임박(D-DAY·D-1)일 때만 알람 아이콘을 붙인다.
  const badgeIcon = urgent ? 'alarm' : published && !closed && dday ? null : status.icon
  const prizeCount = totalPrizeQuantity(event.prizes)
  // 진행 중이면 마감 시각 대신 1초마다 줄어드는 카운트다운을 보여준다. 응모 가능 여부의 최종 판정은 서버가 한다.
  const live = event.displayStatus === 'IN_PROGRESS'
  const now = useNow(live ? 1000 : 60000)
  const countdown = live ? formatCountdown(event.endAt, now) : null
  // 목록을 다시 받기 전에 마감 시각이 지나면 응모 버튼 대신 상세 보기로 바꾼다.
  const deadlinePassed = live && countdown === null

  const cta = closed
    ? event.status === 'PUBLISHED'
      ? { label: '당첨 결과 보기', icon: 'emoji_events' }
      : { label: '결과 준비 중', icon: 'hourglass_top' }
    : event.displayStatus === 'UPCOMING'
      ? { label: '오픈 예정 보기', icon: 'schedule' }
      : deadlinePassed
        ? { label: '이벤트 상세 보기', icon: 'chevron_right' }
        : { label: '응모하기', icon: 'touch_app' }

  const open = () => navigate(`/events/${event.eventId}`)

  // 탐색 목록처럼 많이 훑어볼 때 쓰는 납작한 한 줄 카드. 카드 전체가 상세로 가는 버튼이라 따로 CTA 버튼을 두지 않는다.
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={open}
        disabled={!published}
        className="w-full text-left bg-surface-container-lowest rounded-xl shadow-card p-2.5 flex items-center gap-3 active:scale-[0.98] transition-all"
      >
        {/* 정방형 미리보기는 이벤트 배너 대신 크리에이터 사진(64 × 64)이다. */}
        <ProfilePhoto src={creator.avatar} className="h-16 w-16 shrink-0" iconClassName="text-[28px]" loading="lazy" decoding="async" />
        <div className="min-w-0 flex flex-col gap-0.5">
          {showCreatorTag && <span className="font-label-xs text-label-xs text-outline truncate">{creator.name}</span>}
          <h4 className="font-label-md text-label-md font-semibold text-on-surface line-clamp-1">{event.title}</h4>
          <div className="flex items-center gap-2 font-label-xs text-label-xs text-outline">
            <span
              className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${urgent ? 'bg-error text-on-error' : status.tone}`}
            >
              {badgeIcon && <MaterialIcon name={badgeIcon} className="text-[12px]" />}
              <span className="font-bold">{!published || closed ? status.label : dday || status.label}</span>
            </span>
            {live
              ? <span className={`truncate tabular-nums font-semibold ${urgent ? 'text-error' : 'text-primary'}`}>{countdown ?? '응모 마감'}</span>
              : <span className="truncate">{formatShortDate(event.endAt, { withTime: true })} 마감</span>}
          </div>
        </div>
        {/* 뽑는 인원(winnerCount)이지 지원자 수가 아니다. 지원자 수는 공개 API가 주지 않아 '당첨 인원'으로 분명히 적는다. */}
        <div className="ml-auto shrink-0 pl-2 flex flex-col items-center">
          <span className="font-label-xs text-label-xs text-outline whitespace-nowrap">당첨 인원</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface">{formatNumber(event.winnerCount)}명</span>
        </div>
      </button>
    )
  }

  return (
    <div
      className={`relative bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card flex flex-col group ${
        variant === 'carousel' ? 'snap-center min-w-[270px] max-w-[280px] flex-shrink-0' : 'w-full'
      }`}
    >
      <button type="button" onClick={open} disabled={!published} className="text-left">
        <div className="relative h-36 w-full overflow-hidden bg-surface-container-high">
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={getEventBanner(event.eventId)}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {showCreatorTag && (
            <div className="absolute top-2.5 left-2.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="font-label-xs text-label-xs text-on-surface font-bold">{creator.name}</span>
              <CreatorVerifiedBadge />
            </div>
          )}

          <div
            className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm font-label-xs text-label-xs ${
              urgent ? 'bg-error text-on-error' : status.tone
            }`}
          >
            {badgeIcon && <MaterialIcon name={badgeIcon} className="text-[12px]" />}
            <span className="font-bold">{!published || closed ? status.label : dday || status.label}</span>
          </div>

          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
            <span className="font-label-sm text-label-sm font-medium opacity-90">
              {formatNumber(event.winnerCount)}명 추첨
            </span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col gap-2.5">
          <div>
            <h4 className="font-title-md text-title-md text-on-surface font-bold line-clamp-1">{event.title}</h4>
            {event.rejectReason && (
              <p className="font-label-sm text-label-sm text-error line-clamp-2 mt-1">거절 사유: {event.rejectReason}</p>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
              {event.prizes?.length
                ? event.prizes.map((prize) => prize.displayName).join(' · ')
                : '상품 구성이 아직 공개되지 않았어요.'}
            </p>
          </div>

          <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
            {live ? (
              <span className={`flex items-center gap-1 tabular-nums font-label-md text-label-md font-bold ${urgent ? 'text-error' : 'text-primary'}`}>
                <MaterialIcon name="timer" className="text-[16px]" />
                {countdown ?? '응모 마감'}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MaterialIcon name="event" className="text-[14px]" />
                {formatEventDate(event.endAt)} 마감
              </span>
            )}
            {prizeCount > 0 && <span>상품 {formatNumber(prizeCount)}개</span>}
          </div>
        </div>
      </button>

      {published && (
        <div className="px-3.5 pb-3.5">
          <button
            type="button"
            onClick={open}
            className={`w-full py-2.5 rounded-xl font-label-md text-label-md font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
              closed || deadlinePassed
                ? 'bg-surface-container text-on-surface-variant'
                : 'bg-gradient-to-r from-primary to-[#e11d48] text-on-primary'
            }`}
          >
            <span>{cta.label}</span>
            <MaterialIcon name={cta.icon} className="text-[16px]" />
          </button>
        </div>
      )}

      {onManage && (
        <button
          type="button"
          aria-label="이벤트 관리"
          onClick={onManage}
          className="absolute top-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md active:scale-95"
        >
          <MaterialIcon name="more_horiz" className="text-[20px]" />
        </button>
      )}
    </div>
  )
}
