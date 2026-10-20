import CreatorVerifiedBadge from '../components/ui/CreatorVerifiedBadge.jsx'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import MySpaceLink from '../components/creator/MySpaceLink.jsx'
import { LoadingBlock, ErrorBlock, StatusPill } from '../components/ui/States.jsx'
import { useTheme } from '../context/useTheme.js'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { useProfileSetupRedirect } from '../hooks/useProfileSetupRedirect.js'
import { applyCreator, getMyCreatorApplications } from '../api/creatorApplications.js'
import { describeError } from '../api/client.js'
import { getMySpace, spacePath } from '../api/creatorSpace.js'
import { getMyCreatorProfile } from '../api/creatorProfile.js'
import { formatDateTime } from '../utils/format.js'
import { OPEN_SPACE_EDIT_STATE, activityNameMissing, needsNicknameSetup, ownPublicProfile } from '../utils/publicProfile.js'

const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5174' : null)

const primaryActionClass = 'px-3 py-2 rounded-xl bg-primary text-on-primary text-center font-label-sm text-label-sm font-semibold active:scale-95 transition-all'

/** 프로필·활동명을 먼저 정해야 한다는 안내 배너. bg-berry-tint는 테마와 무관한 연한 분홍이라 글자색도 고정색(berry-deep)을 써야 다크 모드에서 읽힌다. */
function SetupBanner({ to, state, title, description }) {
  return (
    <Link
      to={to}
      state={state}
      className="flex items-center justify-between gap-3 rounded-2xl bg-berry-tint border border-border-rose p-space-md active:scale-[0.99] transition-all"
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-label-md text-label-md font-bold text-berry-deep">{title}</span>
        <span className="font-body-sm text-body-sm text-berry-deep/80">{description}</span>
      </span>
      <MaterialIcon name="chevron_right" className="shrink-0 text-primary" />
    </Link>
  )
}

/**
 * 마이페이지.
 *
 * 로그인한 계정과 심사 대기 중인 크리에이터 전환 신청을 보여주고
 * 권한(크리에이터/관리자)에 따라 운영 화면 진입점을 노출한다.
 */
export default function MyPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const redirectToProfileSetup = useProfileSetupRedirect()
  const { user, isCreator, isAdmin, capabilities, clearUser, refreshCapabilities } = useUser()
  const { isDark, toggleTheme } = useTheme()

  const [applying, setApplying] = useState(false)

  const applications = useAsync(
    () => getMyCreatorApplications({ size: 5 }),
    [],
    { fallbackMessage: '크리에이터 신청 내역을 불러오지 못했습니다.' },
  )

  // 크리에이터의 공개 이름·사진은 Member 닉네임·사진이 아니라 스페이스의 활동명·스페이스 사진이다(Cking-BE #624).
  // 프로필 카드, 스페이스 편집 진입점, 내 스페이스 메뉴가 같은 응답을 쓴다.
  const mySpace = useAsync(() => getMySpace(), [isCreator], { enabled: isCreator, fallbackMessage: '내 스페이스를 불러오지 못했어요.' })
  const myCreatorProfile = useAsync(() => getMyCreatorProfile(), [isCreator], { enabled: isCreator })
  const profile = ownPublicProfile(user, mySpace.data, myCreatorProfile.data)
  const spaceEditTarget = mySpace.data ? spacePath(mySpace.data.slug) : null
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
      if (redirectToProfileSetup(err)) return
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
        <ProfilePhoto src={profile.photo} className="h-16 w-16 shrink-0" iconClassName="text-[28px]" />
        <div className="min-w-0 flex-1">
          {/* 공개 이름은 팬은 닉네임, 크리에이터는 활동명이다. 설정 전에는 OAuth 이름으로 대신하지 않고 안내만 보여준다. */}
          <p className="font-title-lg text-title-lg text-on-surface font-bold truncate">
            {profile.name
              ? profile.name
              : profile.creator
                ? (mySpace.error && myCreatorProfile.error ? '크리에이터 프로필을 불러오지 못했어요' : '활동명을 불러오는 중...')
                : '닉네임 미설정'}
          </p>
          {/* 역할마다 뱃지 하나: 크리에이터는 크리에이터, 관리자는 관리자, 그 외 일반 회원은 팬. 권한 확인 전에는 팬으로 단정하지 않는다. */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap empty:hidden">
            {capabilities.checked && !isCreator && !isAdmin && (
              <StatusPill label="팬" tone="bg-berry-tint text-primary" icon="favorite" />
            )}
            {isCreator && <StatusPill label="크리에이터" tone="bg-secondary-fixed text-on-secondary-fixed" icon="mic" />}
            {isAdmin && (
              <StatusPill label="관리자" tone="bg-inverse-surface text-inverse-on-surface" icon="admin_panel_settings" />
            )}
            {!capabilities.checked && <span className="font-label-xs text-label-xs text-outline">권한 확인 중...</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {/* 크리에이터는 Member 프로필을 바꿀 수 없다(BE가 막는다). 공개 프로필은 스페이스 편집에서 바꾼다. */}
          {isCreator ? (
            spaceEditTarget ? (
              <Link to={spaceEditTarget} state={OPEN_SPACE_EDIT_STATE} className={primaryActionClass}>
                스페이스 편집
              </Link>
            ) : (
              <span aria-disabled="true" className={`${primaryActionClass} opacity-60`}>스페이스 편집</span>
            )
          ) : (
            <Link to="/profile/edit" state={{ from: '/my-page' }} className={primaryActionClass}>
              프로필 편집
            </Link>
          )}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
          >
            계정 변경
          </button>
        </div>
      </section>

      {/* 이메일은 공개 이름이 아니라 로그인 수단이라 프로필 카드 바로 아래, 사진 쪽에 작게 보여준다. */}
      {user?.email && (
        <p className="-mt-space-md truncate px-space-md font-label-xs text-label-xs text-outline">로그인 계정 {user.email}</p>
      )}

      {needsNicknameSetup(user) && (
        <SetupBanner
          to="/profile/edit"
          state={{ from: '/my-page' }}
          title="닉네임을 설정해주세요"
          description="댓글·응모·크리에이터 신청은 닉네임을 정한 뒤에 할 수 있어요."
        />
      )}

      {/* 크리에이터는 닉네임 대신 활동명이 공개 이름이라, 정하기 전에는 댓글·응모·게시글·이벤트를 BE가 막는다. */}
      {activityNameMissing(myCreatorProfile.data) && spaceEditTarget && (
        <SetupBanner
          to={spaceEditTarget}
          state={OPEN_SPACE_EDIT_STATE}
          title="활동명을 설정해주세요"
          description="댓글·응모·게시글·이벤트는 활동명을 정한 뒤에 할 수 있어요."
        />
      )}

      {/* 크리에이터 전환 블록은 신청 전(안내·신청 버튼)과 심사 대기(PENDING, 신청일·심사 대기 중) 동안만 보인다.
          승인·반려로 처리된 뒤에는 숨긴다(이슈 #259). */}
      {!isCreator && (!latestApplication || hasPending) && (
        <section className="flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
          <div className="flex items-center gap-1.5">
            <CreatorVerifiedBadge />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">크리에이터 전환</h3>
          </div>

          {applications.loading && <LoadingBlock label="신청 내역을 불러오는 중..." />}
          {!applications.loading && applications.error && (
            <ErrorBlock message={applications.error} onRetry={applications.reload} />
          )}

          {!applications.loading && !applications.error && (
            <>
              {hasPending ? (
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  신청일 {formatDateTime(latestApplication.requestedAt)}
                </p>
              ) : (
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  크리에이터가 되면 직접 이벤트를 작성하고 응모를 운영할 수 있어요.
                </p>
              )}
              <button
                type="button"
                onClick={handleApplyCreator}
                disabled={applying || hasPending}
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {hasPending ? '심사 대기 중' : applying ? '신청 중...' : '크리에이터 전환 신청하기'}
              </button>
            </>
          )}
        </section>
      )}

      <section className="flex flex-col rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden">
        <Link
          to="/my-tickets"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="confirmation_number" className="text-primary text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">내 응모권</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        {isCreator && <MySpaceLink space={mySpace.data} loading={mySpace.loading} error={mySpace.error} />}
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
            <MaterialIcon name="admin_panel_settings" className="text-primary text-[20px]" />
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
          <MaterialIcon name="confirmation_number" className="text-primary text-[20px]" />
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
          <MaterialIcon name="calendar_month" className="text-primary text-[20px]" />
          <span className="font-label-md text-label-md text-on-surface flex-1">내 캘린더</span>
          <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
        </Link>
        <Link
          to="/notifications"
          className="flex items-center gap-space-sm px-space-md py-space-md border-b border-surface-container-high"
        >
          <MaterialIcon name="notifications" className="text-primary text-[20px]" />
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
          <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} className="text-primary text-[20px]" />
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

    </div>
  )
}
