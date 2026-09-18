import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { creators } from '../data/creators.js'

const MENU = [
  { icon: 'confirmation_number', label: '응모권 내역' },
  { icon: 'favorite', label: '관심 크리에이터 관리' },
  { icon: 'settings', label: '설정' },
  { icon: 'help', label: '고객센터' },
]

export default function MyPage() {
  const totalTickets = creators.reduce((sum, creator) => sum + creator.tickets, 0)

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-lg">
      <section className="flex items-center gap-space-md p-space-md rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shrink-0">
          <MaterialIcon name="person" className="text-on-primary text-[28px]" />
        </div>
        <div className="min-w-0">
          <p className="font-title-lg text-title-lg text-on-surface font-bold">조성원 님</p>
          <p className="font-label-sm text-label-sm text-primary font-semibold">팬 레벨 3 · 열혈 서포터</p>
        </div>
      </section>

      <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-lg flex items-center justify-between">
        <div>
          <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">보유 응모권 합계</p>
          <p className="font-headline-lg text-headline-lg font-bold mt-1">🎟 {totalTickets}장</p>
        </div>
        <MaterialIcon name="local_activity" className="text-[36px] text-primary-fixed" />
      </section>

      <section className="flex flex-col gap-space-sm">
        {creators.map((creator) => (
          <Link
            key={creator.id}
            to={`/creators/${creator.id}`}
            className="flex items-center justify-between p-space-sm rounded-xl bg-surface-container-lowest shadow-sm"
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <img src={creator.avatar} alt={creator.name} className="w-9 h-9 rounded-full object-cover" />
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{creator.name}</span>
            </div>
            <span className="font-label-xs text-label-xs text-primary font-bold">🎟 {creator.tickets}장</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        {MENU.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={`flex items-center gap-space-sm px-space-md py-space-md text-left ${
              index !== MENU.length - 1 ? 'border-b border-surface-container-high' : ''
            }`}
          >
            <MaterialIcon name={item.icon} className="text-on-surface-variant text-[20px]" />
            <span className="font-label-md text-label-md text-on-surface flex-1">{item.label}</span>
            <MaterialIcon name="chevron_right" className="text-outline text-[18px]" />
          </button>
        ))}
      </section>
    </div>
  )
}
