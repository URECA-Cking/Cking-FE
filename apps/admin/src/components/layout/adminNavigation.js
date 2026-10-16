/** 관리자 기능의 현재 제공 범위와 사이드바 표시 순서를 한곳에서 관리한다. */
export const ADMIN_NAVIGATION = [
  {
    label: 'Dashboard',
    items: [{ label: 'Dashboard', icon: 'dashboard', to: '/admin', matches: (location) => location.pathname === '/admin' }],
  },
  {
    label: '심사 관리',
    items: [
      { label: 'Creator 신청', icon: 'how_to_reg', to: '/admin/reviews/creators', matches: (location) => /^\/admin\/reviews\/creators(?:\/|$)/.test(location.pathname) },
      { label: '이벤트 승인', icon: 'fact_check', to: '/admin/reviews/events', matches: (location) => /^\/admin\/reviews\/events(?:\/|$)/.test(location.pathname) },
    ],
  },
  {
    label: '이벤트 운영',
    items: [
      { label: '이벤트 관리', icon: 'event_note', to: '/admin/events', matches: (location) => /^\/admin\/events(?:\/|$)/.test(location.pathname) },
      { label: '추첨 관리', icon: 'casino', to: '/admin/drawings', matches: (location) => /^\/admin\/(drawings|console)(?:\/|$)/.test(location.pathname) },
      { label: '당첨자 관리', icon: 'workspace_premium', to: '/admin/winners', matches: (location) => /^\/admin\/winners(?:\/|$)/.test(location.pathname) },
      { label: '재추첨 관리', icon: 'autorenew', to: '/admin/redraws', matches: (location) => location.pathname.startsWith('/admin/redraws') },
    ],
  },
  {
    label: '운영 관리',
    items: [
      { label: '이상행위 탐지', icon: 'policy', to: '/admin/abuse-detections', matches: (location) => /^\/admin\/abuse-detections(?:\/|$)/.test(location.pathname) },
      { label: '구독 인증 재사용', icon: 'image_search', to: '/admin/subscription-verifications/image-reuse', matches: (location) => location.pathname === '/admin/subscription-verifications/image-reuse' },
      { label: '댓글 신고', icon: 'flag', to: '/admin/comment-reports', matches: (location) => location.pathname === '/admin/comment-reports' },
      { label: '스페이스 차단', icon: 'block', to: '/admin/space-comment-blocks', matches: (location) => location.pathname === '/admin/space-comment-blocks' },
      { label: 'Dead Stream', icon: 'warning', to: '/admin/dead-streams', matches: (location) => location.pathname === '/admin/dead-streams' },
      { label: '응모권 관리', icon: 'confirmation_number', to: '/admin/tickets', matches: (location) => location.pathname === '/admin/tickets' },
    ],
  },
  {
    label: '시스템 관리',
    items: [{ label: 'Creator Space Template', icon: 'space_dashboard', to: '/admin/space-templates', matches: (location) => location.pathname === '/admin/space-templates' }],
  },
]
