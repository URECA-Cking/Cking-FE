import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

export default function CreatorAvatarItem({ creator }) {
  return (
    <Link
      to={`/creators/${creator.id}`}
      className="flex flex-col items-center flex-shrink-0 w-24 group cursor-pointer"
    >
      <div className="relative mb-2">
        <div className="w-[4.5rem] h-[4.5rem] p-1 rounded-full bg-gradient-to-tr from-primary via-surface-tint to-secondary-container shadow-md group-active:scale-95 transition-transform">
          <img
            className="w-16 h-16 rounded-full object-cover bg-surface-container-high"
            src={creator.avatar}
            alt={creator.name}
          />
        </div>
        {creator.verified && (
          <span className="absolute bottom-0 right-0 w-5 h-5 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-sm">
            <MaterialIcon name="verified" className="text-[13px]" />
          </span>
        )}
      </div>
      <span className="font-title-md text-title-md text-on-surface font-semibold truncate max-w-full text-center">
        {creator.name}
      </span>
      <div className="mt-1.5 flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded-full shadow-sm">
        <span className="text-[11px]">🎟</span>
        <span className="font-label-xs text-label-xs text-primary font-bold">{creator.tickets}장</span>
      </div>
    </Link>
  )
}
