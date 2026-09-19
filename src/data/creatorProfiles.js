import { avatarImage, bannerImage } from './images.js'

// 백엔드(Cking-BE)에는 크리에이터 프로필(이름·카테고리·이미지)을 내려주는 API가 없다.
// (docs/api-index.md의 GET /api/creators* 는 아직 컨트롤러가 구현되어 있지 않다.)
// 그래서 화면에 필요한 "보여주기용" 정보는 여기에서 creatorId로부터 결정적으로 만들어 쓰고,
// 응모권 잔액·이벤트·응모처럼 실제 값이 있는 항목만 API에서 가져온다.

const THEMES = [
  { key: 'ive', name: 'IVE', handle: 'IVE_official', category: 'K-POP', followers: '365만', bio: 'DIVE와 함께하는 IVE 공식 드로우 & 커뮤니티 ✨' },
  { key: 'day6', name: 'DAY6', handle: 'day6kilogram', category: '밴드 음악', followers: '190만', bio: '마이데이와 함께 만드는 DAY6 공식 팬 공간' },
  { key: 'aespa', name: 'AESPA', handle: 'aespa_official', category: 'K-POP', followers: '420만', bio: 'MY와 함께하는 AESPA 공식 드롭 채널' },
  { key: 'newjeans', name: '뉴진스', handle: 'newjeans_official', category: 'K-POP', followers: '480만', bio: '버니즈를 위한 뉴진스 공식 응모 공간' },
  { key: 'chimchakman', name: '침착맨', handle: 'chimchakman', category: '토크/예능', followers: '250만', bio: '침착맨 굿즈 추첨 및 팬 이벤트 공간' },
  { key: 'syukaworld', name: '슈카월드', handle: 'syukaworld', category: '경제/이슈', followers: '320만', bio: '슈카월드 시청자를 위한 이벤트 공간' },
]

/** creatorId(숫자)로 화면 표시에 필요한 프로필을 결정적으로 만든다. */
export function getCreatorProfile(creatorId) {
  const id = Number(creatorId)
  if (!Number.isFinite(id)) {
    return {
      creatorId,
      name: '크리에이터',
      handle: 'creator',
      category: '크리에이터',
      followers: '-',
      bio: '',
      verified: true,
      avatar: avatarImage('creator-unknown'),
      banner: bannerImage('creator-banner-unknown', 900, 500),
    }
  }
  const theme = THEMES[((id - 1) % THEMES.length + THEMES.length) % THEMES.length]
  return {
    creatorId: id,
    name: theme.name,
    handle: theme.handle,
    category: theme.category,
    followers: theme.followers,
    bio: theme.bio,
    verified: true,
    avatar: avatarImage(`${theme.key}-${id}`),
    banner: bannerImage(`${theme.key}-banner-${id}`, 900, 500),
  }
}

/** 이벤트 카드 배너처럼 이벤트 단위로 다른 이미지가 필요할 때 사용한다. */
export function getEventBanner(eventId) {
  return bannerImage(`event-${eventId}`, 900, 500)
}

/** 크리에이터 탐색의 카테고리 필터 목록(프로필 테마에서 파생). */
export const CREATOR_CATEGORIES = ['전체', ...Array.from(new Set(THEMES.map((theme) => theme.category)))]
