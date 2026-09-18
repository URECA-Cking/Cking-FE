import { avatarImage } from './images.js'

export const creators = [
  {
    id: 'ive',
    name: 'IVE',
    category: 'K-POP',
    followers: '365만',
    tickets: 8,
    verified: true,
    bio: 'DIVE와 함께하는 IVE 공식 드로우 & 커뮤니티 ✨',
    avatar: avatarImage('ive-creator'),
    banner: avatarImage('ive-banner', 800),
  },
  {
    id: 'day6',
    name: 'DAY6',
    category: '밴드 음악',
    followers: '190만',
    tickets: 3,
    verified: true,
    bio: '마이데이와 함께 만드는 DAY6 공식 팬 공간',
    avatar: avatarImage('day6-creator'),
    banner: avatarImage('day6-banner', 800),
  },
  {
    id: 'aespa',
    name: 'AESPA',
    category: 'K-POP',
    followers: '420만',
    tickets: 5,
    verified: true,
    bio: 'MY와 함께하는 AESPA 공식 드롭 채널',
    avatar: avatarImage('aespa-creator'),
    banner: avatarImage('aespa-banner', 800),
  },
  {
    id: 'newjeans',
    name: '뉴진스',
    category: 'K-POP',
    followers: '480만',
    tickets: 1,
    verified: true,
    bio: '버니즈를 위한 뉴진스 공식 응모 공간',
    avatar: avatarImage('newjeans-creator'),
    banner: avatarImage('newjeans-banner', 800),
  },
  {
    id: 'chimchakman',
    name: '침착맨',
    category: '토크/예능',
    followers: '250만',
    tickets: 0,
    verified: true,
    bio: '침착맨 굿즈 추첨 및 팬 이벤트 공간',
    avatar: avatarImage('chimchakman-creator'),
    banner: avatarImage('chimchakman-banner', 800),
  },
  {
    id: 'syukaworld',
    name: '슈카월드',
    category: '경제/이슈',
    followers: '320만',
    tickets: 0,
    verified: true,
    bio: '슈카월드 시청자를 위한 이벤트 공간',
    avatar: avatarImage('syukaworld-creator'),
    banner: avatarImage('syukaworld-banner', 800),
  },
]

export const exploreCreators = [
  {
    id: 'yuna',
    name: '유나 (YUNA)',
    category: 'K-POP / 보컬 아티스트',
    followers: '14.8만',
    badge: 'TOP CREATOR',
    description: '신곡 발매 기념 한정판 친필 사인 LP 드롭 진행 중!',
    avatar: avatarImage('yuna-explore'),
    banner: avatarImage('yuna-banner', 520, 300),
  },
  {
    id: 'waveclub',
    name: '웨이브클럽 (WAVE)',
    category: '인디 밴드 / 프로듀서',
    followers: '8.2만',
    badge: '급상승 중',
    description: '단독 콘서트 VIP 백스테이지 패스 래플 예정',
    avatar: avatarImage('waveclub-explore'),
    banner: avatarImage('waveclub-banner', 520, 300),
  },
  {
    id: 'roki',
    name: '아티스트 로키',
    category: '웹툰 / 일러스트',
    followers: '22.4만',
    badge: '오리지널 드롭',
    description: '1:1 커스텀 드로잉 커미션 참여권 오픈 완료',
    avatar: avatarImage('roki-explore'),
    banner: avatarImage('roki-banner', 520, 300),
  },
]

export const trendingCreators = [
  { id: 'dexter', name: '팀 덱스터', change: '+142%', avatar: avatarImage('dexter-trend') },
  { id: 'moderntech-ryu', name: '모던테크 류', change: '+89%', avatar: avatarImage('moderntech-trend') },
  { id: 'sona', name: '소나 (Sona)', change: '+65%', avatar: avatarImage('sona-trend') },
]

export const newCreators = [
  { id: 'moonlightsound', name: '달빛사운드', category: '모던 락 밴드', tag: 'band', avatar: avatarImage('moonlight-new') },
  { id: 'chaewon', name: 'CHAEWON', category: '안무가 & 댄서', tag: 'kpop', avatar: avatarImage('chaewon-new') },
  { id: 'arcadeking', name: '아케이드 킹', category: '종합 게임 스트리머', tag: 'streamer', avatar: avatarImage('arcadeking-new') },
  { id: 'myomyostudio', name: '묘묘스튜디오', category: '캐릭터 인스타툰', tag: 'webtoon', avatar: avatarImage('myomyo-new') },
]

export function getCreatorById(id) {
  return creators.find((creator) => creator.id === id)
}
