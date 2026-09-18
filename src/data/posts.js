import { bannerImage } from './images.js'

export const posts = [
  {
    id: 'ive-post-1',
    creatorId: 'ive',
    creatorHandle: 'IVE_official',
    timeAgo: '18분 전',
    image: bannerImage('ive-post-1', 700, 700),
    caption: 'DIVE 여러분! 오늘 녹음실 비하인드 컷 깜짝 공개합니다 🎙️❤️ 곧 찾아올 팬미팅에서 만나요!',
    tags: ['#IVE', '#아이브', '#DIVE', '#팬미팅비하인드'],
    likes: 14290,
    comments: 842,
  },
  {
    id: 'ive-post-2',
    creatorId: 'ive',
    creatorHandle: 'IVE_official',
    timeAgo: '1일 전',
    image: bannerImage('ive-post-2', 700, 700),
    caption: '이번 공식 팬미팅 한정 아크릴 스탠드와 친필 사인 포토카드 실물이에요 ✨',
    tags: ['#IVE_MD', '#포토카드', '#친필사인굿즈'],
    likes: 28100,
    comments: 1204,
  },
  {
    id: 'day6-post-1',
    creatorId: 'day6',
    creatorHandle: 'day6kilogram',
    timeAgo: '2시간 전',
    image: bannerImage('day6-post-1', 700, 700),
    caption: '합주 연습 끝! My Day 여러분이 기다려주신 특별한 선물도 준비되어 있으니 드로우 꼭 챙겨가세요 🎸🍀',
    tags: ['#DAY6', '#마이데이', '#합주비하인드'],
    likes: 9280,
    comments: 412,
  },
]

export function getPostsByCreator(creatorId) {
  return posts.filter((post) => post.creatorId === creatorId)
}
