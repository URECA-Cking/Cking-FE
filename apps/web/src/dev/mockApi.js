// 개발 전용 더미 API. 로그인·BE 없이 화면을 확인할 때만 쓴다.
// main.jsx가 import.meta.env.DEV일 때만 불러오므로 배포 빌드에는 들어가지 않는다(가짜 데이터를 제품에 섞지 않는다).
//
// 사용: 개발 서버에서 주소 끝에 ?mock=1(팬) / ?mock=creator(크리에이터) / ?mock=empty(팔로우·이벤트 없음)를 붙인다.
// ?mock=restricted(플랫폼 댓글 작성 제한)·?mock=blocked(스페이스 차단)는 팬 시나리오에 더해, 댓글 작성·수정이
// 403(COMMENT_RESTRICTED·SPACE_COMMENT_BLOCKED)으로 막히고 제재 알림이 도착한 상태를 보여준다.
// ?mock=creator는 내 스페이스(하늘)에서 댓글의 "…" 메뉴로 차단을 걸고 "차단 관리" 탭에서 해제하는 것까지 보여준다.
// 선택은 sessionStorage에 남아 이동해도 유지되고, ?mock=0으로 끈다.
// AI Quiz(생성·검토·Judge·게시, 팬 응시)는 quizMock.js가 맡는다.

import { quizMockRoutes } from './quizMock.js'

const STORAGE_KEY = 'cking.mock'
const COMMON_REFLECT_DELAY_MS = 6000
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

const avatar = (letter, hue) => URL.createObjectURL(new Blob([
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="hsl(${hue} 45% 38%)"/><text x="48" y="62" font-size="42" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter}</text></svg>`,
], { type: 'image/svg+xml' }))

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
  const sanctionMode = scenario === 'restricted' || scenario === 'blocked'
  // BE 오류 메시지와 같은 형식: java.time.Instant 문자열이 "해제 시각(UTC): " 뒤에 붙는다.
  const sanctionEnd = new Date(now + 3 * DAY + 1500).toISOString()
  const sanctionError = scenario === 'blocked'
    ? { status: 403, code: 'SPACE_COMMENT_BLOCKED', data: null, message: `이 스페이스에서 댓글 작성이 제한되었습니다. 해제 시각(UTC): ${sanctionEnd}` }
    : { status: 403, code: 'COMMENT_RESTRICTED', data: null, message: `댓글 작성이 제한되었습니다. 해제 시각(UTC): ${sanctionEnd}` }
  // 크리에이터 시나리오의 스페이스 댓글 차단(BE sanction/api.md). 해제·생성 결과가 목록에 반영되도록 상태를 들고 있다.
  const blockAt = (offset) => new Date(now + offset).toISOString()
  // 차단 중인 회원을 두 페이지(20+4)가 되도록 늘려 "더 보기"와 해제 뒤 목록 맞춤을 확인할 수 있게 한다.
  const extraBlocks = Array.from({ length: 23 }, (_, i) => ({
    sanctionId: 4 + i, memberId: 100 + i, memberName: `후원자 ${i + 1}`, startedAt: blockAt(-(i + 3) * HOUR), endsAt: blockAt((10 + i) * DAY + 1500), releasedAt: null,
  }))
  const blocks = [
    { sanctionId: 3, memberId: 12, memberName: '열혈팬', startedAt: blockAt(-2 * DAY), endsAt: blockAt(5 * DAY + 1500), releasedAt: null },
    ...extraBlocks,
    { sanctionId: 2, memberId: 13, memberName: '지나가던 사람', startedAt: blockAt(-9 * DAY), endsAt: blockAt(21 * DAY), releasedAt: blockAt(-8 * DAY) },
    { sanctionId: 1, memberId: 14, memberName: '예전 악플러', startedAt: blockAt(-40 * DAY), endsAt: blockAt(-33 * DAY), releasedAt: null },
  ]
  const blockView = (block) => ({ ...block, active: block.releasedAt === null && Date.parse(block.endsAt) > Date.now() })
  const blockError = (status, code, message) => ({ status, code, data: null, message })
  const minuteUtc = (iso) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
  const endsUtc = minuteUtc(new Date(now + 3 * DAY + 60000).toISOString())
  // 제목·본문은 BE SanctionNotificationService와 같은 문구다(플랫폼 제한 / 크리에이터의 스페이스 차단).
  const sanctionNotifications = scenario === 'blocked'
    ? [
        {
          notificationId: 2, event: null, drawing: null, type: 'COMMENT_RESTRICTION_STARTED', title: '스페이스 댓글 작성 제한 안내',
          body: `하늘의 스페이스에서 댓글 작성이 제한되었습니다. ${endsUtc}까지 이 스페이스에서 댓글을 작성하거나 수정할 수 없습니다.`,
          createdAt: new Date(now - HOUR).toISOString(), readAt: null,
        },
        {
          notificationId: 1, event: null, drawing: null, type: 'COMMENT_RESTRICTION_RELEASED', title: '스페이스 댓글 작성 제한 해제 안내',
          body: '민준의 스페이스에서 댓글 작성 제한이 해제되었습니다.',
          createdAt: new Date(now - 5 * DAY).toISOString(), readAt: new Date(now - 4 * DAY).toISOString(),
        },
      ]
    : [
        {
          notificationId: 2, event: null, drawing: null, type: 'COMMENT_RESTRICTION_STARTED', title: '댓글 작성 제한 안내',
          body: `신고된 댓글이 관리자에 의해 숨김 처리되어 경고 1회가 기록되었습니다. ${endsUtc}까지 댓글을 작성하거나 수정할 수 없습니다.`,
          createdAt: new Date(now - HOUR).toISOString(), readAt: null,
        },
        {
          notificationId: 1, event: null, drawing: null, type: 'COMMENT_RESTRICTION_RELEASED', title: '댓글 작성 제한 해제 안내',
          body: '댓글 작성 제한이 해제되었습니다.',
          createdAt: new Date(now - 5 * DAY).toISOString(), readAt: new Date(now - 4 * DAY).toISOString(),
        },
      ]
  const events = empty ? [] : buildEvents(now)
  const posts = empty ? {} : buildPosts(now)
  const follows = empty ? [] : FOLLOWED
  let attendanceDone = false
  let attendanceAt = null // 출석 완료 시각. 공용 응모권 잔액은 실제 BE처럼 이 시각에서 한참 뒤에야 늘어난다.

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
    ['GET', /^\/api\/me\/notifications$/, () => page(empty ? [] : sanctionMode ? sanctionNotifications : [{ notificationId: 1, readAt: null, createdAt: new Date(now - HOUR).toISOString() }])],
    ['PATCH', /^\/api\/me\/notifications\/(\d+)\/read$/, (id) => ({ notificationId: Number(id), readAt: new Date().toISOString() })],
    ...(creatorMode
      ? [
          ['GET', /^\/api\/creators\/(\d+)\/posts\/(\d+)\/comments$/, (_id, postId) => page([
            { commentId: 501, postId: Number(postId), authorMemberId: 12, authorName: '열혈팬', authorProfileImageUrl: null, writtenByCreator: false, content: '오늘도 응원해요!', filtered: false, revealable: false, createdAt: blockAt(-3 * HOUR), updatedAt: blockAt(-3 * HOUR) },
            { commentId: 502, postId: Number(postId), authorMemberId: 15, authorName: null, authorProfileImageUrl: null, writtenByCreator: false, content: null, filtered: true, revealable: true, createdAt: blockAt(-2 * HOUR), updatedAt: blockAt(-2 * HOUR) },
            { commentId: 503, postId: Number(postId), authorMemberId: me.memberId, authorName: '하늘', authorProfileImageUrl: null, writtenByCreator: true, content: '다들 와줘서 고마워요', filtered: false, revealable: false, createdAt: blockAt(-1 * HOUR), updatedAt: blockAt(-1 * HOUR) },
          ])],
          ['POST', /^\/api\/creator\/comment-blocks$/, (url, init) => {
            const body = JSON.parse(init.body ?? '{}')
            if (!Number.isInteger(body.days) || body.days < 1 || body.days > 365) return blockError(400, 'VALIDATION_FAILED', '기간 오류')
            if (body.memberId === me.memberId) return blockError(400, 'CANNOT_BLOCK_SELF', '자기 자신은 차단할 수 없습니다.')
            const existing = blocks.find((block) => block.memberId === body.memberId && blockView(block).active)
            if (existing) return { status: 201, code: 'SUCCESS', data: blockView(existing) }
            const created = { sanctionId: Math.max(...blocks.map((block) => block.sanctionId)) + 1, memberId: body.memberId, memberName: body.memberId === 15 ? '가려진 회원' : `회원 ${body.memberId}`, startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + body.days * DAY).toISOString(), releasedAt: null }
            blocks.unshift(created)
            return { status: 201, code: 'SUCCESS', data: blockView(created) }
          }],
          ['GET', /^\/api\/creator\/comment-blocks$/, (url) => {
            const size = Number(url.searchParams.get('size')) || 20
            const pageNo = Number(url.searchParams.get('page')) || 0
            const views = blocks.map(blockView).filter((block) => url.searchParams.get('active') !== 'true' || block.active)
            const items = views.slice(pageNo * size, (pageNo + 1) * size)
            return { items, page: pageNo, size, totalElements: views.length, totalPages: Math.ceil(views.length / size), hasNext: (pageNo + 1) * size < views.length }
          }],
          ['POST', /^\/api\/creator\/comment-blocks\/(\d+)\/release$/, (id) => {
            const block = blocks.find((item) => item.sanctionId === Number(id))
            if (!block) return blockError(404, 'RESOURCE_NOT_FOUND', '없는 차단')
            if (blockView(block).active) block.releasedAt = new Date().toISOString()
            return blockView(block)
          }],
        ]
      : []),
    // 제재 시나리오에서만: 댓글 목록은 비어 있고, 작성·수정은 제한 오류로 막힌다(삭제는 막지 않는다).
    ...(sanctionMode
      ? [
          ['GET', /^\/api\/creators\/(\d+)\/posts\/(\d+)\/comments$/, () => page([])],
          ['POST', /^\/api\/creators\/(\d+)\/posts\/(\d+)\/comments$/, () => sanctionError],
          ['PATCH', /^\/api\/creators\/(\d+)\/posts\/(\d+)\/comments\/(\d+)$/, () => sanctionError],
        ]
      : []),
    ['GET', /^\/api\/creators$/, () => page(CREATORS)],
    ['GET', /^\/api\/events$/, () => page(events)],
    ['GET', /^\/api\/creators\/(\d+)\/tickets$/, (id) => ({ creatorId: Number(id), balance: BALANCES[id] ?? 0 })],
    // 공용 응모권 잔액. 이벤트 목업의 myCommonTicketBalance와 같은 값이고, 팔로우·이벤트가 없는 시나리오(empty)는 0이다.
    // 출석을 완료하면 DB 반영이 비동기인 것처럼 COMMON_REFLECT_DELAY_MS 뒤에 1장이 늘어난다.
    ['GET', /^\/api\/tickets\/common$/, () => {
      const reflected = attendanceAt !== null && Date.now() - attendanceAt > COMMON_REFLECT_DELAY_MS
      return { userId: me.memberId, balance: (empty ? 0 : 2) + (reflected ? 1 : 0), updatedAt: new Date().toISOString() }
    }],
    ['GET', /^\/api\/creators\/(\d+)\/posts$/, (id, url) => page((posts[id] ?? []).slice(0, Number(url.searchParams.get('size')) || 20))],
    ['GET', /^\/api\/creators\/(\d+)\/space$/, (id) => {
      const creator = CREATORS.find((c) => c.creatorId === Number(id))
      return creator ? { ...creator, followerCount: 1200 + creator.creatorId * 311 } : null
    }],
    ['GET', /^\/api\/missions$/, () => [{ missionId: 7, type: 'ATTENDANCE', rewardAmount: 1, activeFrom: null, activeTo: null, completedToday: attendanceDone }]],
    [
      'POST',
      /^\/api\/missions\/(\d+)\/complete$/,
      () => {
        attendanceDone = true
        attendanceAt = Date.now()
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
    // 크리에이터 모드의 내 Space(크리에이터 1). 내 Space 화면(Quiz 관리 등)을 확인할 때 쓴다.
    ['GET', /^\/api\/creator\/space$/, () => (creatorMode ? CREATORS[0] : { status: 403, code: 'FORBIDDEN', data: null })],
    ...quizMockRoutes({ myCreatorId: creatorMode ? 1 : null, memberId: me.memberId }),
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
      const result = await handler(...match.slice(1), url, init)
      const status = result?.status ?? 200
      const body = result?.code ? { code: result.code, data: result.data, message: result.message ?? null } : { code: 'SUCCESS', data: result, message: null }
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', data: null, message: '더미 API에 없는 요청입니다.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  console.info(`[mock] 더미 API 사용 중 (${scenario}). 끄려면 ?mock=0`)
}
