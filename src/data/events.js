import { bannerImage } from './images.js'

export const events = [
  {
    id: 'ive-fanmeeting',
    creatorId: 'ive',
    creatorName: 'IVE',
    title: 'IVE FAN MEETING INVITATION',
    subtitle: 'IVE FIRST EXCLUSIVE VIP FAN MEETING',
    description:
      'DIVE를 위한 프라이빗 팬미팅 초대권 및 스페셜 웰컴 기프트 패키지 드로우. 무대 바로 앞 VIP 1열 지정석에서 아이브와 함께하세요!',
    date: '2025.04.18 (금) 19:00',
    place: '서울 올림픽홀',
    banner: bannerImage('ive-fanmeeting', 900, 500),
    dDay: 'D-3',
    quotaLabel: '30명 추첨',
    applied: 1420,
    quota: 3000,
    entryTier: 'VIP 플로어석',
    perks: [
      { icon: 'airplane_ticket', title: 'VIP 단독 스탠딩석', desc: '무대 최인접 1열 구역 입장권' },
      { icon: 'card_membership', title: '스페셜 미공개 포카', desc: '멤버별 홀로그램 6종 세트' },
    ],
  },
  {
    id: 'day6-guitarpick',
    creatorId: 'day6',
    creatorName: 'DAY6',
    title: 'DAY6 무대 친필 사인 기타 피크 드로우',
    subtitle: 'DAY6 WORLD TOUR STAGE-USED PICK SET',
    description: '월드투어 무대에서 직접 연주한 리얼 기타 피크 케이스 세트 + 인증 카드',
    date: '2025.04.21 (월) 20:00',
    place: '온라인 발표',
    banner: bannerImage('day6-guitarpick', 900, 500),
    dDay: 'D-1',
    quotaLabel: '단 5명 한정',
    applied: 4600,
    quota: 5000,
    entryTier: '한정 굿즈',
    perks: [
      { icon: 'music_note', title: '실제 무대 사용 피크', desc: '월드투어 현장 사용 기타 피크' },
      { icon: 'verified', title: '정품 인증서 동봉', desc: '시리얼 넘버 인증 카드 포함' },
    ],
  },
  {
    id: 'ive-photocard',
    creatorId: 'ive',
    creatorName: 'IVE',
    title: 'IVE 친필 사인 포토카드 세트',
    subtitle: 'IVE SIGNED PHOTOCARD COLLECTION',
    description: '멤버 전원 친필 사인이 담긴 포토카드 6종 세트 드로우',
    date: '2025.04.24 (목) 18:00',
    place: '온라인 발표',
    banner: bannerImage('ive-photocard', 900, 500),
    dDay: 'D-6',
    quotaLabel: '50명 추첨',
    applied: 890,
    quota: 2000,
    entryTier: '한정 굿즈',
    perks: [
      { icon: 'card_membership', title: '멤버 전원 친필 사인', desc: '6종 포토카드 풀세트' },
      { icon: 'inventory_2', title: '전용 포장 패키지', desc: '수집용 아크릴 케이스 동봉' },
    ],
  },
]

export function getEventById(id) {
  return events.find((event) => event.id === id)
}

export function getEventsByCreator(creatorId) {
  return events.filter((event) => event.creatorId === creatorId)
}
