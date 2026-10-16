import { useState } from 'react'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import PlatformSanctionsPanel from '../../components/sanction/PlatformSanctionsPanel.jsx'
import SpaceBlocksPanel from '../../components/sanction/SpaceBlocksPanel.jsx'

/** 제재 범위 탭. 스페이스 차단은 한 스페이스에서만, 플랫폼 제한은 모든 스페이스에서 댓글 작성·수정을 막는다. */
const SCOPE_TABS = [
  { id: 'space', label: '스페이스 차단' },
  { id: 'platform', label: '플랫폼 제한' },
]

/**
 * 걸려 있는 댓글 작성 제재를 범위별로 보고 해제한다(BE 이슈 #579·#584, Cking-FE 이슈 #231).
 * 제재는 신고 관리 화면(/admin/comment-reports)에서 건다. 스페이스 차단과 플랫폼 제한은 목록·해제 API가 서로 달라
 * 탭으로 나누고, 서로 상대 것을 해제할 수 없다.
 */
export default function AdminSpaceCommentBlocks() {
  const [scope, setScope] = useState('space')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="제재 관리"
        description="걸려 있는 댓글 작성 제재를 확인하고 해제합니다. 스페이스 차단은 한 스페이스에서만, 플랫폼 제한은 모든 스페이스에서 댓글을 쓰지 못하게 합니다. 제재는 신고 관리 화면에서 걸 수 있습니다."
      />

      <div role="tablist" aria-label="제재 범위" className="flex w-fit gap-1 rounded-md bg-slate-100 p-1">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={scope === tab.id}
            onClick={() => setScope(tab.id)}
            className={`h-8 rounded px-3 text-sm font-medium ${scope === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {scope === 'space' ? <SpaceBlocksPanel /> : <PlatformSanctionsPanel />}
    </div>
  )
}
