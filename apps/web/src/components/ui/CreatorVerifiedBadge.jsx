import MaterialIcon from './MaterialIcon.jsx'

/** Creator Space의 인증 아이콘을 모든 Creator 표시에서 공유한다. */
export default function CreatorVerifiedBadge() {
  return (
    <MaterialIcon
      name="verified"
      filled
      role="img"
      aria-label="인증된 크리에이터"
      className="shrink-0 text-[16px] text-primary md:text-[18px]"
    />
  )
}
