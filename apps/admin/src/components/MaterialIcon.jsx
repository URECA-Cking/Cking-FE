/** Material Symbol 이름을 아이콘 요소로 표시한다. */
export default function MaterialIcon({ name, className = '', filled = false }) { return <span className={`material-symbols-outlined ${filled ? 'icon-fill' : ''} ${className}`.trim()}>{name}</span> }
