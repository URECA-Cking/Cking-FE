import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import { LoadingBlock, ErrorBlock, StatusPill } from '../components/ui/States.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { applyCreator, getMyCreatorApplications } from '../api/creatorApplications.js'
import { describeError } from '../api/client.js'
import { formatDateTime, formatNumber } from '../utils/format.js'
import { CREATOR_APPLICATION_STATUS_META } from '../utils/eventStatus.js'

/**
 * 마이페이지.
 *
 * 로그인한 계정, 크리에이터별 실제 응모권 잔액, 크리에이터 전환 신청 상태를 보여주고
 * 권한(크리에이터/관리자)에 따라 운영 화면 진입점을 노출한다.
 */
export default function MyPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, userId, isCreator, isAdmin, capabilities, clearUser, refreshCapabilities, followedCreators } = useUser()

  const [applying, setApplying] = useState(false)
  const [ledgerTarget, setLedgerTarget] = useState(null)

  const directory = useAsync(() => loadCreatorDirectory(userId), [userId], {
    fallbackMessage: '응모권 정보를 불러오지 못했습니다.',
  })
  const applications = useAsync(
    () => getMyCreatorApplications(userId, { size: 5 }),
    [userId],
    { fallbackMessage: '크리에이터 신청 내역을 불러오지 못했습니다.' },
  )

  const creators = directory.data?.creators ?? []
  const totalTickets = creators.reduce((sum, creator) => sum + creator.balance, 0)
  const latestApplication = applications.data?.items?.[0] ?? null
  const hasPending = latestApplication?.status === 'PENDING'

  async function handleApplyCreator() {
    setApplying(true)
    try {
      const result = await applyCreator(userId)
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

  function handleLogout() {
    clearUser()
    showToast('로그아웃되었습니다.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-lg">
      <section className="flex items-center gap-space-md p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shrink-0">
          <MaterialIcon name="person" className="text-on-primary text-[28px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-title-lg text-title-lg text-on-surface font-bold truncate">{user?.name} 님</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">userId: {userId}</p>
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

      <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating flex items-center justify-between">
        <div>
          <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">보유 응모권 합계</p>
          <p className="font-headline-lg text-headline-lg font-bold mt-1">🎟 {formatNumber(totalTickets)}장</p>
          <p className="font-label-xs text-label-xs text-primary-fixed mt-1">
            관심 크리에이터 {followedCreators.length}명
          </p>
        </div>
        <MaterialIcon name="local_activity" className="text-[36px] text-primary-fixed" />
      </section>

      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-title-md text-title-md text-on-surface font-bold">크리에이터별 응모권</h3>
          <Link to="/onboarding/creators" className="font-label-sm text-label-sm text-primary font-semibold">
            관심 관리
          </Link>
        </div>
        {directory.loading && <LoadingBlock label="응모권을 불러오는 중..." />}
        {!directory.loading && directory.error && (
          <ErrorBlock message={directory.error} onRetry={directory.reload} />
        )}
        {!directory.loading &&
          !directory.error &&
          creators.map((creator) => (
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
                    {creator.balanceUpdatedAt ? `${formatDateTime(creator.balanceUpdatedAt)} 기준` : '변동 내역 없음'}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setLedgerTarget(creator)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-berry-tint text-primary font-label-xs text-label-xs font-bold active:scale-95 transition-all shrink-0"
              >
                🎟 {formatNumber(creator.balance)}장
                <MaterialIcon name="chevron_right" className="text-[14px]" />
              </button>
            </div>
          ))}
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
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
          >
            <MaterialIcon name="admin_panel_settings" className="text-primary text-[20px]" />
            <span className="font-label-md text-label-md text-on-surface flex-1">관리자 콘솔</span>
            <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
          </Link>
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
          to="/notifications"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="notifications" className="text-on-surface-variant text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">알림</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
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
        userId={userId}
        balance={ledgerTarget?.balance ?? 0}
      />
    </div>
  )
}
