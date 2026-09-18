import MaterialIcon from '../components/ui/MaterialIcon.jsx'

const NOTIFICATIONS = [
  {
    id: 1,
    icon: 'celebration',
    title: 'IVE FAN MEETING 당첨 결과가 공개됐어요',
    desc: '결과를 지금 바로 확인해보세요.',
    time: '10분 전',
  },
  {
    id: 2,
    icon: 'confirmation_number',
    title: '출석 미션 완료로 응모권 1장을 받았어요',
    desc: 'IVE 전용 응모권이 적립되었습니다.',
    time: '3시간 전',
  },
  {
    id: 3,
    icon: 'favorite',
    title: 'DAY6가 새 게시물을 올렸어요',
    desc: '좋아요를 누르고 응모권을 받아보세요.',
    time: '어제',
  },
]

export default function Notifications() {
  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-sm">
      <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-1">알림</h2>
      {NOTIFICATIONS.map((item) => (
        <div key={item.id} className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex items-start gap-space-md">
          <div className="w-10 h-10 rounded-full bg-berry-tint flex items-center justify-center text-primary shrink-0">
            <MaterialIcon name={item.icon} className="text-[20px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-label-md text-label-md text-on-surface font-semibold">{item.title}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{item.desc}</p>
          </div>
          <span className="font-label-xs text-label-xs text-outline shrink-0">{item.time}</span>
        </div>
      ))}
    </div>
  )
}
