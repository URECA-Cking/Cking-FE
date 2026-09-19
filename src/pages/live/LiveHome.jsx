import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { getUsers, selectUser as selectUserApi } from '../../api/users.js'
import { ApiError } from '../../api/client.js'
import { LoadingBlock, ErrorBlock } from './liveUi.jsx'

const MENU_ITEMS = [
  {
    to: '/live/events',
    icon: 'confirmation_number',
    title: '이벤트 목록 · 응모',
    desc: 'GET /api/events, 응모 신청, 응모 내역, 응모권 이력',
  },
  {
    to: '/live/notifications',
    icon: 'notifications',
    title: '알림',
    desc: 'GET /api/me/notifications, 읽음 처리',
  },
  {
    to: '/live/creator-application',
    icon: 'workspace_premium',
    title: '크리에이터 전환 신청',
    desc: 'POST /api/creator/applications, 내 신청 내역',
  },
]

export default function LiveHome() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, selectUser } = useUser()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const items = await getUsers()
      setUsers(items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '사용자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSelect(candidate) {
    setSelectingId(candidate.userId)
    try {
      const result = await selectUserApi(candidate.userId)
      selectUser({ userId: result?.userId ?? candidate.userId, name: result?.name ?? candidate.name })
      showToast(`${result?.name ?? candidate.name}님으로 전환되었습니다.`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '사용자 선택에 실패했습니다.', { icon: 'error' })
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32 bg-surface">
      <BackHeader title="백엔드 기능 확인" onBack={() => navigate('/')} />

      <div className="pt-16 px-margin flex flex-col gap-space-lg">
        <div className="p-space-md rounded-2xl bg-berry-tint flex items-start gap-space-sm">
          <MaterialIcon name="info" className="text-primary text-[20px] shrink-0 mt-0.5" />
          <p className="font-body-sm text-body-sm text-berry-deep leading-relaxed">
            아직 로그인 기능이 없어 가상 사용자(demo user) 중 하나를 선택해 실제 백엔드 API를 호출해봅니다.
            선택한 사용자는 이 브라우저에 저장되어 이후 모든 요청에 사용됩니다.
          </p>
        </div>

        <section className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-title-md text-title-md font-bold text-on-surface">가상 사용자 선택</h2>
            <span className="font-label-xs text-label-xs text-on-surface-variant">GET /api/users</span>
          </div>

          {user && (
            <div className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                <MaterialIcon name="check" className="text-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="font-label-sm text-label-sm text-on-surface-variant">현재 선택된 사용자</p>
                <p className="font-title-md text-title-md font-bold text-on-surface truncate">
                  {user.name} <span className="text-on-surface-variant font-label-sm text-label-sm">(#{user.userId})</span>
                </p>
              </div>
            </div>
          )}

          {loading && <LoadingBlock label="사용자 목록을 불러오는 중..." />}
          {!loading && error && <ErrorBlock message={error} onRetry={loadUsers} />}
          {!loading && !error && (
            <div className="flex flex-col gap-2">
              {users.map((candidate) => {
                const isCurrent = user?.userId === candidate.userId
                return (
                  <button
                    key={candidate.userId}
                    type="button"
                    disabled={selectingId === candidate.userId}
                    onClick={() => handleSelect(candidate)}
                    className={`flex items-center justify-between gap-space-sm p-space-sm rounded-xl border transition-all active:scale-[0.98] disabled:opacity-60 ${
                      isCurrent
                        ? 'bg-berry-tint border-border-rose'
                        : 'bg-surface-container-lowest border-transparent hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                        <MaterialIcon name="person" className="text-[18px]" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-label-md text-label-md font-semibold text-on-surface truncate">{candidate.name}</p>
                        <p className="font-label-xs text-label-xs text-on-surface-variant">userId: {candidate.userId}</p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <MaterialIcon name="check_circle" filled className="text-primary text-[20px] shrink-0" />
                    ) : (
                      <span className="font-label-xs text-label-xs text-primary font-semibold shrink-0">선택</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-space-sm">
          <h2 className="font-title-md text-title-md font-bold text-on-surface">기능 바로가기</h2>
          <div className="flex flex-col gap-2">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-space-sm p-space-md rounded-2xl bg-surface-container-lowest shadow-sm active:scale-[0.98] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-berry-tint flex items-center justify-center text-primary shrink-0">
                  <MaterialIcon name={item.icon} className="text-[22px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md font-bold text-on-surface">{item.title}</p>
                  <p className="font-label-xs text-label-xs text-on-surface-variant truncate">{item.desc}</p>
                </div>
                <MaterialIcon name="chevron_right" className="text-on-surface-variant text-[20px] shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        <section className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-xs">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <MaterialIcon name="construction" className="text-[18px]" />
            <span className="font-label-md text-label-md font-bold text-on-surface">아직 연동하지 않은 기능</span>
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant leading-relaxed">
            크리에이터 목록/상세(GET /api/creators*)와 미션 완료 API는 문서(api-index)에는 있지만
            실제 백엔드 컨트롤러가 아직 구현되어 있지 않아 이번 화면에서는 제외했어요. 백엔드에 해당 API가
            추가되면 이어서 연동할 수 있어요.
          </p>
        </section>
      </div>
    </div>
  )
}
