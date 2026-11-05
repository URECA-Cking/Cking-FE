import { nameWithId } from '../utils/format.js'

/** 이름 옆에 ID를 작게 보여준다. 제재·응모권 화면은 ID로 찾고, 같은 이름의 회원도 ID로 구분한다. */
export default function NameWithId({ name, id }) {
  const label = nameWithId(name, id)
  return (
    <>
      {label.name}
      {label.idLabel && <span className="ml-1 text-xs text-slate-500">{label.idLabel}</span>}
    </>
  )
}
