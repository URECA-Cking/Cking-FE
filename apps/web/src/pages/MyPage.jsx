import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import MySpaceLink from '../components/creator/MySpaceLink.jsx'
import { LoadingBlock, ErrorBlock, StatusPill } from '../components/ui/States.jsx'
import { useTheme } from '../context/useTheme.js'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { applyCreator, getMyCreatorApplications } from '../api/creatorApplications.js'
import { describeError } from '../api/client.js'
import { formatDateTime, formatNumber } from '../utils/format.js'
import { CREATOR_APPLICATION_STATUS_META } from '../utils/eventStatus.js'

// 팔로우한 크리에이터가 많을 수 있어 처음엔 3명만 그리고 '더 보기'를 누르면 나머지를 모두 보여준다.
const CREATOR_PAGE_SIZE = 3

const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5174' : null)

/**
 * 마이페이지.
 *
 * 로그인한 계정, 크리에이터별 실제 응모권 잔액, 크리에이터 전환 신청 상태를 보여주고
 * 권한(크리에이터/관리자)에 따라 운영 화면 진입점을 노출한다.
 */
export default function MyPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, isCreator, isAdmin, capabilities, clearUser, refreshCapabilities, followedCreators } = useUser()
  const { isDark, toggleTheme } = useTheme()

  const [applying, setApplying] = useState(false)
  const [ledgerTarget, setLedgerTarget] = useState(null)
  const [creatorLimit, setCreatorLimit] = useState(CREATOR_PAGE_SIZE)

  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '응모권 정보를 불러오지 못했습니다.',
  })
  // 팔로우가 많을 수 있어 일부만 그린다. 잔액도 화면에 그린 크리에이터만 조회한다.
  const followedProfiles = useMemo(
    () => (directory.data?.creators ?? []).filter((creator) => followedCreators.includes(creator.creatorId)),
    [directory.data, followedCreators],
  )
  const shownProfiles = useMemo(() => followedProfiles.slice(0, creatorLimit), [followedProfiles, creatorLimit])
  const shownIds = useMemo(() => shownProfiles.map((creator) => creator.creatorId), [shownProfiles])
  const { balances, failedIds, retry: retryBalances, loading: balancesLoading } = useCreatorBalances(shownIds, user?.memberId)
  const applications = useAsync(
    () => getMyCreatorApplications({ size: 5 }),
    [],
    { fallbackMessage: '크리에이터 신청 내역을 불러오지 못했습니다.' },
  )

  const creators = useMemo(
    () => shownProfiles.map((creator) => ({
      ...creator,
      balance: balances.get(creator.creatorId)?.balance,
      balanceUpdatedAt: balances.get(creator.creatorId)?.updatedAt,
      balanceError: failedIds.has(creator.creatorId),
    })),
    [shownProfiles, balances, failedIds],
  )
  const latestApplication = applications.data?.items?.[0] ?? null
  const hasPending = latestApplication?.status === 'PENDING'

  async function handleApplyCreator() {
    setApplying(true)
    try {
      const result = await applyCreator()
      showToast(
        result?.status === 'PENDING'
          ? '크리에이터 전환 신청이 접수됐어요. 관리자 승인을 기다려주세요.'
          : `신청 상태: ${result?.status}`,
      )
      await Promise.all([applications.reload(), refreshCapabilities()])
    } catch (err) {
      showToast(describeError(err, '크리에이터 전환 신청에 실패했습니다.'), { icon: 'error' })
    } finally {
      setApplying(false)
    }
  }

  async function handleLogout() {
    await clearUser()
    showToast('로그아웃되었습니다.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-lg md:mx-auto md:max-w-5xl md:px-8">
      <section className="flex items-center gap-space-md p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shrink-0">
          <MaterialIcon name="person" className="text-on-primary text-[28px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-title-lg text-title-lg text-on-surface font-bold truncate">{user?.name} 님</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{user?.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatusPill label="팬" tone="bg-berry-tint text-primary" icon="favorite" />
            {isCreator && <StatusPill label="크리에이터" tone="bg-secondary-fixed text-on-secondary-fixed" icon="mic" />}
            {isAdmin && (
              <StatusPill label="관리자" tone="bg-inverse-surface text-inverse-on-surface" icon="admin_panel_settings" />
            )}
            {!capabilities.checked && <span className="font-label-xs text-label-xs text-outline">권한 확인 중...</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold active:scale-95 transition-all shrink-0"
        >
          계정 변경
        </button>
      </section>

      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-title-md text-title-md text-on-surface font-bold">관심 크리에이터별 응모권</h3>
          <Link to="/onboarding/creators" className="font-label-sm text-label-sm text-primary font-semibold">
            관심 관리
          </Link>
        </div>
        {directory.loading && <LoadingBlock label="응모권을 불러오는 중..." />}
        {!directory.loading && directory.error && (
          <ErrorBlock message={directory.error} onRetry={directory.reload} />
        )}
        {failedIds.size > 0 && !directory.error && (
          <button type="button" onClick={retryBalances} disabled={balancesLoading} className="self-start font-label-sm text-label-sm text-primary disabled:opacity-50">
            응모권 잔액 다시 조회
          </button>
        )}
        {!directory.loading && !directory.error && (
          <div className="flex flex-col gap-space-sm md:grid md:grid-cols-2">
          {creators.map((creator) => (
            <div
              key={creator.creatorId}
              className="flex items-center justify-between p-space-sm rounded-xl bg-surface-container-lowest shadow-card"
            >
              <Link to={`/creators/${creator.creatorId}`} className="flex items-center gap-space-sm min-w-0 flex-1">
                <img src={creator.avatar} alt={creator.name} className="w-9 h-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate block">
                    {creator.name}
                  </span>
                  <span className="font-label-xs text-label-xs text-outline">
                    {typeof creator.balance !== 'number'
                      ? creator.balanceError ? '잔액 조회 실패' : '잔액 확인 중'
                      : creator.balanceUpdatedAt
                        ? `${formatDateTime(creator.balanceUpdatedAt)} 기준`
                        : '변동 내역 없음'}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setLedgerTarget(creator)}
                disabled={typeof creator.balance !== 'number'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-berry-tint text-primary font-label-xs text-label-xs font-bold active:scale-95 transition-all shrink-0"
              >
                🎟 {typeof creator.balance === 'number' ? `${formatNumber(creator.balance)}장` : creator.balanceError ? '조회 실패' : '조회 중'}
                <MaterialIcon name="chevron_right" className="text-[14px]" />
              </button>
            </div>
          ))}
          {followedProfiles.length > shownProfiles.length && (
            <button
              type="button"
              onClick={() => setCreatorLimit(Infinity)}
              className="md:col-span-2 h-10 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md font-semibold active:scale-95 transition-all"
            >
              더 보기 ({formatNumber(followedProfiles.length - shownProfiles.length)}명 남음)
            </button>
          )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="workspace_premium" className="text-primary text-[20px]" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">크리에이터 전환</h3>
          </div>
          {latestApplication && (
            <StatusPill
              label={CREATOR_APPLICATION_STATUS_META[latestApplication.status]?.label ?? latestApplication.status}
              tone={CREATOR_APPLICATION_STATUS_META[latestApplication.status]?.tone}
              icon={CREATOR_APPLICATION_STATUS_META[latestApplication.status]?.icon}
            />
          )}
        </div>

        {applications.loading && <LoadingBlock label="신청 내역을 불러오는 중..." />}
        {!applications.loading && applications.error && (
          <ErrorBlock message={applications.error} onRetry={applications.reload} />
        )}

        {!applications.loading && !applications.error && (
          <>
            {latestApplication ? (
              <div className="flex flex-col gap-1">
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  신청일 {formatDateTime(latestApplication.requestedAt)}
                </p>
                {latestApplication.reviewedAt && (
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    심사일 {formatDateTime(latestApplication.reviewedAt)}
                  </p>
                )}
                {latestApplication.rejectReason && (
                  <p className="font-body-sm text-body-sm text-error">거절 사유: {latestApplication.rejectReason}</p>
                )}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                크리에이터가 되면 직접 이벤트를 만들고 응모를 운영할 수 있어요.
              </p>
            )}

            {!isCreator && (
              <button
                type="button"
                onClick={handleApplyCreator}
                disabled={applying || hasPending}
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {hasPending ? '심사 대기 중' : applying ? '신청 중...' : '크리에이터 전환 신청하기'}
              </button>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden">
        {isCreator && <MySpaceLink />}
        {isCreator && (
          <Link
            to="/studio"
            className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
          >
            <MaterialIcon name="dashboard" className="text-primary text-[20px]" />
            <span className="font-label-md text-label-md text-on-surface flex-1">크리에이터 스튜디오</span>
            <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
          </Link>
        )}
        {isAdmin && ADMIN_BASE_URL && (
          <a
            href={ADMIN_BASE_URL}
            className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
          >
            <MaterialIcon name="admin_panel_settings" className="text-primary text-[20px]" />
            <span className="font-label-md text-label-md text-on-surface flex-1">관리자 콘솔</span>
            <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
          </a>
        )}
        {isAdmin && !ADMIN_BASE_URL && (
          <div
            className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high text-on-surface-variant"
            aria-disabled="true"
          >
            <MaterialIcon name="admin_panel_settings" className="text-outline text-[20px]" />
            <div className="flex-1">
              <span className="block font-label-md text-label-md">관리자 콘솔</span>
              <span className="font-label-xs text-label-xs">서비스 준비 중</span>
            </div>
            <MaterialIcon name="schedule" className="text-outline text-[18px]" />
          </div>
        )}
        <Link
          to="/my-entries"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="confirmation_number" className="text-on-surface-variant text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">내 응모 내역</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        <Link
          to="/my-winners"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="emoji_events" className="text-primary text-[20px]" filled />
          <span className="font-label-md text-label-md text-on-surface flex-1">내 당첨</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        <Link
          to="/my-calendar"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="calendar_month" className="text-on-surface-variant text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">내 캘린더</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        <Link
          to="/notifications"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="notifications" className="text-on-surface-variant text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">알림</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label="다크 모드"
          onClick={toggleTheme}
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high text-left"
        >
          <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} className="text-on-surface-variant text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">다크 모드</span>
          <span
            aria-hidden="true"
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${isDark ? 'bg-primary' : 'bg-outline'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-space-sm px-space-md py-space-md text-left"
        >
          <MaterialIcon name="logout" className="text-error text-[20px]" />
          <span className="font-label-md text-label-md text-error flex-1">로그아웃</span>
        </button>
      </section>

      <TicketLedgerSheet
        open={Boolean(ledgerTarget)}
        onClose={() => setLedgerTarget(null)}
        creatorId={ledgerTarget?.creatorId}
        creatorName={ledgerTarget?.name}
        balance={ledgerTarget?.balance ?? 0}
      />
    </div>
  )
}
