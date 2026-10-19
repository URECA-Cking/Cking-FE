import { Link } from 'react-router-dom'
import MaterialIcon from './MaterialIcon.jsx'

// 스페이스 화면에는 하단 내비게이션이 없어 오른쪽 아래에 바로 고정한다. 시트(z-40)와 게시글 상세(z-60)보다 아래에 둔다.
const WRAPPER_CLASS =
  'pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 justify-end px-margin md:max-w-[935px] md:px-8'
const BUTTON_CLASS =
  'pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Creator Space의 만들기 버튼(게시글·이벤트·일정·Quiz). 모든 탭이 같은 위치·크기·색으로 `+` 아이콘만 보여 주고,
 * 글자는 aria-label로 읽힌다. 화면 이동이면 to, 동작이면 onClick을 넘긴다.
 */
export default function CreateFab({ label, onClick, to, disabled = false }) {
  const icon = <MaterialIcon name="add" className="text-[26px]" />
  return (
    <div className={WRAPPER_CLASS}>
      {to ? (
        <Link to={to} aria-label={label} className={BUTTON_CLASS}>{icon}</Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={BUTTON_CLASS}>{icon}</button>
      )}
    </div>
  )
}
