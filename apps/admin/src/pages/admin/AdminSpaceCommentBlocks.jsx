import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import PlatformSanctionsPanel from '../../components/sanction/PlatformSanctionsPanel.jsx'
import SpaceBlocksPanel from '../../components/sanction/SpaceBlocksPanel.jsx'

/** 제재 범위 탭. 스페이스 차단은 한 스페이스에서만, 플랫폼 제한은 모든 스페이스에서 댓글 작성·수정을 막는다. */
const SCOPE_TABS = [
  { id: 'space', label: '스페이스 차단' },
  { id: 'platform', label: '플랫폼 제한' },
]
const SCOPE_PARAM = 'scope'

function tabFromParam(value) {
  return SCOPE_TABS.some((tab) => tab.id === value) ? value : SCOPE_TABS[0].id
}

/**
 * 걸려 있는 댓글 작성 제재를 범위별로 보고 해제한다(BE 이슈 #579·#584, Cking-FE 이슈 #231).
 * 제재는 신고 관리 화면(/admin/comment-reports)에서 건다. 스페이스 차단과 플랫폼 제한은 목록·해제 API가 서로 달라
 * 탭으로 나누고, 서로 상대 것을 해제할 수 없다.
 *
 * 경로(/admin/space-comment-blocks)와 컴포넌트 이름은 스페이스 차단만 다루던 때의 것을 그대로 둔다. 이미 쓰는 주소(북마크·공유한 링크)가
 * 깨지지 않게 하려는 것이라 화면 이름(`제재 관리`)과 다르다. 선택한 탭은 주소의 `?scope=platform`으로 남겨 새로고침해도 유지한다.
 * 한 번 연 탭의 패널은 숨기기만 하고 닫지 않아 탭을 오가도 그 패널의 필터와 페이지가 남는다.
 */
export default function AdminSpaceCommentBlocks() {
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = tabFromParam(searchParams.get(SCOPE_PARAM))
  // 열어 본 탭. 아직 열지 않은 탭은 목록을 불러오지 않는다.
  const [opened, setOpened] = useState(() => new Set([scope]))
  const tabRefs = useRef({})

  function selectTab(id, { focus = false } = {}) {
    setOpened((current) => (current.has(id) ? current : new Set(current).add(id)))
    setSearchParams(id === SCOPE_TABS[0].id ? {} : { [SCOPE_PARAM]: id }, { replace: true })
    if (focus) tabRefs.current[id]?.focus()
  }

  /** 좌우 방향키·Home·End로 탭을 옮긴다. 키보드에서는 선택된 탭만 Tab으로 들어간다(roving tabindex). */
  function onTabKeyDown(event, index) {
    const last = SCOPE_TABS.length - 1
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    selectTab(SCOPE_TABS[target].id, { focus: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="제재 관리"
        description="걸려 있는 댓글 작성 제재를 확인하고 해제합니다. 스페이스 차단은 한 스페이스에서만, 플랫폼 제한은 모든 스페이스에서 댓글을 쓰지 못하게 합니다. 제재는 신고 관리 화면에서 걸 수 있습니다."
      />

      <div role="tablist" aria-label="제재 범위" className="flex w-fit gap-1 rounded-md bg-slate-100 p-1">
        {SCOPE_TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[tab.id] = node }}
            id={`sanction-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={scope === tab.id}
            aria-controls={`sanction-panel-${tab.id}`}
            tabIndex={scope === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={`h-8 rounded px-3 text-sm font-medium ${scope === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {SCOPE_TABS.map((tab) => (
        // 열어 본 탭만 그리고, 선택되지 않은 패널은 hidden으로 숨겨 입력해 둔 필터를 지킨다.
        opened.has(tab.id) || scope === tab.id ? (
          <div
            key={tab.id}
            id={`sanction-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`sanction-tab-${tab.id}`}
            hidden={scope !== tab.id}
            className="flex flex-col gap-6"
          >
            {tab.id === 'space' ? <SpaceBlocksPanel /> : <PlatformSanctionsPanel />}
          </div>
        ) : null
      ))}
    </div>
  )
}
