import { useUser } from '../../context/useUser.js'

export default function FollowStatus() {
  const { status, followsError, reloadFollows } = useUser()
  if (status !== 'authenticated' || !followsError) return null
  return (
    <div role="alert" className="mx-margin mt-space-sm flex items-center justify-between gap-3 rounded-xl bg-surface-container-high px-3 py-2 text-on-surface">
      <span className="font-body-sm text-body-sm">관심 크리에이터 목록을 불러오지 못했어요.</span>
      <button type="button" onClick={reloadFollows} className="shrink-0 font-label-sm text-label-sm font-semibold text-primary">
        다시 시도
      </button>
    </div>
  )
}
