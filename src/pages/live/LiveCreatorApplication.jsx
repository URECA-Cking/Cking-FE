import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { applyCreator, getMyCreatorApplications } from '../../api/creatorApplications.js'
import { ApiError } from '../../api/client.js'
import { CREATOR_APPLICATION_STATUS_LABEL, LoadingBlock, ErrorBlock, EmptyBlock, StatusPill, UserGate, formatDateTime } from './liveUi.jsx'

export default function LiveCreatorApplication() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useUser()

  const [page, setPage] = useState({ items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getMyCreatorApplications(user.userId, { page: 0, size: 20 })
      setPage(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '신청 내역을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleApply() {
    if (!user) return
    setApplying(true)
    try {
      await applyCreator(user.userId)
      showToast('크리에이터 전환 신청이 접수되었습니다.')
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '신청에 실패했습니다.', { icon: 'error' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32 bg-surface">
      <BackHeader title="크리에이터 전환 신청" onBack={() => navigate('/live')} />

      <div className="pt-16 px-margin flex flex-col gap-space-lg">
        <UserGate user={user}>
          <section className="p-space-md rounded-2xl bg-berry-tint flex flex-col gap-space-sm">
            <div className="flex items-center gap-2 text-primary">
              <MaterialIcon name="workspace_premium" className="text-[22px]" />
              <span className="font-title-md text-title-md font-bold text-on-surface">크리에이터로 전환하기</span>
            </div>
            <p className="font-body-sm text-body-sm text-berry-deep leading-relaxed">
              현재 선택된 사용자({user?.name})로 크리에이터 전환을 신청합니다.
            </p>
            <button
              type="button"
              disabled={applying}
              onClick={handleApply}
              className="w-full h-12 rounded-xl bg-primary text-on-primary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {applying ? '신청 처리 중...' : '신청하기'}
            </button>
            <span className="self-end font-label-xs text-label-xs text-berry-deep">POST /api/creator/applications</span>
          </section>

          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-title-md text-title-md font-bold text-on-surface">내 신청 내역</h2>
              <span className="font-label-xs text-label-xs text-on-surface-variant">GET .../applications/me</span>
            </div>
            {loading && <LoadingBlock label="신청 내역을 불러오는 중..." />}
            {!loading && error && <ErrorBlock message={error} onRetry={load} />}
            {!loading && !error && (page.items ?? []).length === 0 && <EmptyBlock message="아직 신청 내역이 없어요." />}
            {!loading && !error && (page.items ?? []).length > 0 && (
              <div className="flex flex-col gap-2">
                {page.items.map((item) => {
                  const statusMeta = CREATOR_APPLICATION_STATUS_LABEL[item.status] ?? { label: item.status, className: 'bg-surface-container text-on-surface-variant' }
                  return (
                    <div key={item.applicationId} className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <StatusPill label={statusMeta.label} className={statusMeta.className} />
                        <span className="font-label-xs text-label-xs text-on-surface-variant">#{item.applicationId}</span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">신청일 {formatDateTime(item.requestedAt)}</span>
                      {item.reviewedAt && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">심사일 {formatDateTime(item.reviewedAt)}</span>
                      )}
                      {item.rejectReason && (
                        <p className="font-label-xs text-label-xs text-primary">거절 사유: {item.rejectReason}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </UserGate>
      </div>
    </div>
  )
}
