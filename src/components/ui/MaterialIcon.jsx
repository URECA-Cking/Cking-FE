export default function MaterialIcon({ name, className = '', filled = false, style, ...rest }) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-fill' : ''} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {name}
    </span>
  )
}
