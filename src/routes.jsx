import Home from './pages/Home'
import User from './pages/User'

// Header 네비게이션과 App.jsx의 Route 정의가 실제로 이 배열 하나에서 파생된다.
// 페이지가 늘어나면 이 배열에 항목만 추가하면 Header 메뉴와 라우팅이 함께 등록된다.
export const ROUTES = [
  { path: '/', label: '홈', element: <Home /> },
  { path: '/user', label: '사용자', element: <User /> },
]
