import MaterialIcon from './MaterialIcon.jsx'

/** 헤더 왼쪽의 뒤로 가기 버튼. 상단 바들이 같은 모양을 쓰도록 한 곳에 둔다. */
export default function BackButton({ onClick }) {
  return (
    <button
      type="button"
      aria-label="뒤로가기"
      onClick={onClick}
      className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface shrink-0"
    >
      <MaterialIcon name="arrow_back" className="text-[22px]" />
    </button>
  )
}
