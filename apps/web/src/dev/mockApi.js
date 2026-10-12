// 개발 전용 더미 API. 로그인·BE 없이 화면을 확인할 때만 쓴다.
// main.jsx가 import.meta.env.DEV일 때만 불러오므로 배포 빌드에는 들어가지 않는다(가짜 데이터를 제품에 섞지 않는다).
//
// 사용: 개발 서버에서 주소 끝에 ?mock=1(팬) / ?mock=creator(크리에이터) / ?mock=empty(팔로우·이벤트 없음)를 붙인다.
// 선택은 sessionStorage에 남아 이동해도 유지되고, ?mock=0으로 끈다.

const STORAGE_KEY = 'cking.mock'
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

const avatar = (letter, hue) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="hsl(${hue} 45% 38%)"/><text x="48" y="62" font-size="42" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter}</text></svg>`,
)}`

const CREATORS = [
  { creatorId: 1, creatorName: '하늘', slug: 'haneul', profileImageUrl: avatar('하', 210) },
  { creatorId: 2, creatorName: '민준', slug: 'minjun', profileImageUrl: avatar('민', 150) },
  { creatorId: 3, creatorName: '서연서연서연서연', slug: 'seoyeon', profileImageUrl: avatar('서', 330) },
  { creatorId: 4, creatorName: '도윤', slug: 'doyun', profileImageUrl: null },
  { creatorId: 5, creatorName: '지우', slug: 'jiwoo', profileImageUrl: avatar('지', 40) },
]

const FOLLOWED = [1, 2, 3, 4]
const BALANCES = { 1: 3, 2: 0, 3: 5, 4: 1 }

function buildEvents(now) {
  const at = (offset) => new Date(now + offset).toISOString()
  const base = { drawMethod: 'RANDOM', prizeAlgorithmVersion: 'v1', myCommonTicketBalance: 2, status: 'OPEN' }
  const prizes = [{ displayName: '친필 사인 앨범', quantity: 3 }]
  return [
    { ...base, eventId: 11, creatorId: 1, title: '가을 팬미팅 초대', displayStatus: 'IN_PROGRESS', startAt: at(-9 * DAY), endAt: at(2 * DAY), winnerCount: 20, prizes },
    { ...base, eventId: 12, creatorId: 2, title: '친필 사인 앨범 추첨', displayStatus: 'IN_PROGRESS', startAt: at(-4 * DAY), endAt: at(9 * DAY), winnerCount: 5, prizes },
    { ...base, eventId: 13, creatorId: 3, title: '아주 긴 제목의 이벤트라서 한 줄에 다 들어가지 않는 경우를 확인합니다', displayStatus: 'IN_PROGRESS', startAt: at(-1 * DAY), endAt: at(14 * DAY), winnerCount: 10, prizes },
    { ...base, eventId: 14, creatorId: 4, title: '겨울 한정 굿즈 세트', displayStatus: 'IN_PROGRESS', startAt: at(-3 * HOUR), endAt: at(30 * DAY), winnerCount: 30, prizes },
    { ...base, eventId: 15, creatorId: 5, title: '라이브 방송 초대권', displayStatus: 'UPCOMING', status: 'SCHEDULED', startAt: at(3 * DAY), endAt: at(20 * DAY), winnerCount: 8, prizes },
    { ...base, eventId: 16, creatorId: 1, title: '지난 팬싸인회', displayStatus: 'CLOSED', status: 'PUBLISHED', startAt: at(-30 * DAY), endAt: at(-5 * DAY), winnerCount: 10, prizes },
  ]
}

function buildPosts(now) {
  const ago = (ms) => new Date(now - ms).toISOString()
  const post = (postId, creatorId, content, createdAt) => ({
    postId, creatorId, visibility: 'PUBLIC', locked: false, content, imageCount: 0, images: [], createdAt, updatedAt: createdAt,
  })
  return {
    1: [
      post(101, 1, '오늘 팬미팅 리허설 비하인드 사진 올려요. 다들 와줘서 고마워요!', ago(3 * HOUR)),
      post(104, 1, '다음 주 방송 스케줄 공유해요', ago(2 * DAY)),
      post(105, 1, '지난 콘서트 셋리스트 정리', ago(6 * DAY)),
    ],
    2: [{ ...post(102, 2, '', ago(5 * HOUR)), imageCount: 1, images: [{ imageKey: 'k', url: avatar('사', 20) }] }],
    3: [post(103, 3, '지난주 공연 후기', ago(4 * DAY))],
  }
}

export function installMockApiIfRequested() {
  const param = new URLSearchParams(window.location.search).get('mock')
  try {
    if (param === '0') sessionStorage.removeItem(STORAGE_KEY)
    else if (param) sessionStorage.setItem(STORAGE_KEY, param)
  } catch {
    // 저장소를 못 써도 이번 로드의 쿼리값으로는 동작한다.
  }
  let scenario = param === '0' ? null : param
  try {
    scenario = scenario ?? sessionStorage.getItem(STORAGE_KEY)
  } catch {
    // 위와 같다.
  }
  if (!scenario) return

  const now = Date.now()
  const empty = scenario === 'empty'
  const creatorMode = scenario === 'creator'
  const events = empty ? [] : buildEvents(now)
  const posts = empty ? {} : buildPosts(now)
  const follows = empty ? [] : FOLLOWED
  let attendanceDone = false

  const page = (items) => ({ items, page: 0, size: items.length, totalElements: items.length, totalPages: 1, hasNext: false })
  const me = {
    memberId: 900,
    name: '테스트 팬',
    role: 'USER',
    onboardingCompleted: true,
    creator: creatorMode ? { creatorId: 1 } : null,
  }

  const routes = [
    ['POST', /^\/api\/auth\/refresh$/, () => ({ accessToken: 'mock-token', expiresIn: 3600 })],
    ['GET', /^\/api\/me$/, () => me],
    ['GET', /^\/api\/me\/follows$/, () => page(follows.map((creatorId) => ({ creatorId })))],
    ['GET', /^\/api\/me\/notifications$/, () => page(empty ? [] : [{ notificationId: 1, readAt: null, createdAt: new Date(now - HOUR).toISOString() }])],
    ['GET', /^\/api\/creators$/, () => page(CREATORS)],
    ['GET', /^\/api\/events$/, () => page(events)],
    ['GET', /^\/api\/creators\/(\d+)\/tickets$/, (id) => ({ creatorId: Number(id), balance: BALANCES[id] ?? 0 })],
    ['GET', /^\/api\/creators\/(\d+)\/posts$/, (id, url) => page((posts[id] ?? []).slice(0, Number(url.searchParams.get('size')) || 20))],
    ['GET', /^\/api\/creators\/(\d+)\/space$/, (id) => CREATORS.find((c) => c.creatorId === Number(id)) ?? null],
    ['GET', /^\/api\/missions$/, () => [{ missionId: 7, type: 'ATTENDANCE', rewardAmount: 1, activeFrom: null, activeTo: null, completedToday: attendanceDone }]],
    [
      'POST',
      /^\/api\/missions\/(\d+)\/complete$/,
      () => {
        attendanceDone = true
        return { status: 202, code: 'EARN_ACCEPTED', data: { missionId: 7, rewardAmount: 1, completedAt: new Date().toISOString() } }
      },
    ],
    ['GET', /^\/api\/events\/(\d+)\/entries\/me$/, (id) => ({ items: Number(id) === 12 ? [{ entryId: 1, usedTicketCount: 2, couponType: 'CREATOR', appliedAt: new Date(now - DAY).toISOString() }] : [], nextCursor: null, hasNext: false })],
    [
      'GET',
      /^\/api\/tickets\/common\/history$/,
      () => {
        // 어제·그제·4일 전에 출석한 것으로 둔다(UTC 하루 단위).
        const earn = (daysAgo, ledgerId) => ({ ledgerId, deltaAmount: 1, type: 'EARN', missionId: 7, createdAt: new Date(now - daysAgo * DAY).toISOString() })
        return { userId: 900, items: empty ? [] : [earn(1, 3), earn(2, 2), earn(4, 1)], nextCursor: null, hasNext: false }
      },
    ],
    ['GET', /^\/api\/me\/winners$/, () => (empty ? [] : [{ winnerId: 100, eventId: 16, winnerManagementStatus: 'SELECTED' }])],
  ]

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    // 공통 클라이언트는 URL 객체를, 다른 호출은 문자열이나 Request를 넘긴다.
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
    const method = (init.method ?? 'GET').toUpperCase()
    for (const [routeMethod, pattern, handler] of routes) {
      const match = routeMethod === method && url.pathname.match(pattern)
      if (!match) continue
      const result = handler(...match.slice(1), url)
      const status = result?.status ?? 200
      const body = result?.code ? { code: result.code, data: result.data, message: null } : { code: 'SUCCESS', data: result, message: null }
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', data: null, message: '더미 API에 없는 요청입니다.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  console.info(`[mock] 더미 API 사용 중 (${scenario}). 끄려면 ?mock=0`)
}
