import MaterialIcon from '../ui/MaterialIcon.jsx'

/** 완료 표시. 윤곽선 대신 원을 채우고 안에 체크를 넣는다. 기본은 초록, 핑크 바탕 위에서는 tone="onPrimary"로 흰 원에 핑크 체크. */
export default function FilledCheck({ size = 20, tone = 'success', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${tone === 'onPrimary' ? 'bg-white text-primary' : 'bg-success text-white'} ${className}`}
      style={{ width: size, height: size }}
    >
      <MaterialIcon name="check" style={{ fontSize: Math.round(size * 0.72), fontWeight: 700 }} />
    </span>
  )
}
