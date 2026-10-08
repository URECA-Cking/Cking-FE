import { Link } from 'react-router-dom'

/** 홈 섹션 제목. 크고 굵은 제목 아래에 맥락을 주는 핑크 부제를 붙일 수 있고, 오른쪽에는 "전체" 링크 하나만 둔다. */
export default function SectionTitle({ title, subtitle, to }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div className="min-w-0">
        <h3 className="font-headline-md text-headline-md text-on-surface truncate">{title}</h3>
        {subtitle && <p className="font-label-sm text-label-sm text-primary font-normal truncate">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="shrink-0 pb-0.5 font-label-sm text-label-sm text-outline hover:text-on-surface-variant transition-colors">
          전체
        </Link>
      )}
    </div>
  )
}
