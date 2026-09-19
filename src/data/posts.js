import { bannerImage } from './images.js'
import { getCreatorProfile } from './creatorProfiles.js'

// 백엔드에 게시물(피드) API가 없어 화면 구성용 샘플 게시물을 creatorId 기준으로 만들어 둔다.
// 응모권 적립 같은 실제 값이 걸린 동작은 여기에 의존하지 않는다.

const TEMPLATES = [
  {
    slot: 1,
    minutesAgo: 18,
    caption: '오늘 녹음실 비하인드 컷 깜짝 공개합니다 🎙️❤️ 곧 찾아올 팬미팅에서 만나요!',
    tags: ['#비하인드', '#팬미팅'],
    likes: 14290,
    comments: 842,
  },
  {
    slot: 2,
    minutesAgo: 60 * 24,
    caption: '이번 공식 한정 아크릴 스탠드와 친필 사인 포토카드 실물이에요 ✨',
    tags: ['#MD', '#포토카드', '#친필사인굿즈'],
    likes: 28100,
    comments: 1204,
  },
  {
    slot: 3,
    minutesAgo: 60 * 2,
    caption: '합주 연습 끝! 여러분이 기다려주신 특별한 선물도 준비되어 있으니 드로우 꼭 챙겨가세요 🍀',
    tags: ['#연습실', '#드로우'],
    likes: 9280,
    comments: 412,
  },
]

/** 크리에이터 한 명의 샘플 게시물 목록을 결정적으로 만든다. */
export function getPostsByCreator(creatorId) {
  const creator = getCreatorProfile(creatorId)
  return TEMPLATES.map((template) => ({
    id: `creator-${creator.creatorId}-post-${template.slot}`,
    creatorId: creator.creatorId,
    creatorHandle: creator.handle,
    avatar: creator.avatar,
    createdAt: new Date(Date.now() - template.minutesAgo * 60 * 1000).toISOString(),
    image: bannerImage(`post-${creator.creatorId}-${template.slot}`, 700, 700),
    caption: template.caption,
    tags: [`#${creator.name}`, ...template.tags],
    likes: template.likes,
    comments: template.comments,
  }))
}

/** 여러 크리에이터의 게시물을 최신순으로 섞어 홈 피드에 쓴다. */
export function getFeedPosts(creatorIds, limit = 4) {
  return creatorIds
    .flatMap((creatorId) => getPostsByCreator(creatorId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
}
