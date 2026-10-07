import MaterialIcon from './MaterialIcon.jsx'
/** 관리자 하위 화면의 뒤로가기 헤더를 표시한다. */
export default function BackHeader({ title, onBack, right }) { return <header className="fixed top-0 z-50 w-full bg-surface/90 shadow-card"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-margin"><div className="flex min-w-0 items-center"><button type="button" aria-label="뒤로가기" onClick={onBack} className="mr-2"><MaterialIcon name="arrow_back" /></button><h1 className="truncate text-title-md font-semibold">{title}</h1></div>{right}</div></header> }
