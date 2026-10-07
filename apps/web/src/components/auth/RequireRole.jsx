import { Link } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock } from '../ui/States.jsx'
import { useUser } from '../../context/useUser.js'

/**
 * 크리에이터/관리자 전용 화면 가드.
 *
 * 백엔드가 사용자 목록에 역할을 담아주지 않기 때문에, 권한은 해당 역할 전용 조회 API를
 * 한 번 호출해본 결과(UserContext의 capabilities)로 판단한다. 판정 전에는 로딩을 보여준다.
 */
export default function RequireRole({ role, children }) {
  const { capabilities, isCreator, isAdmin } = useUser()
  const allowed = role === 'admin' ? isAdmin : isCreator

  if (!capabilities.checked) {
    return <LoadingBlock label="권한을 확인하는 중..." />
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-margin text-center">
        <MaterialIcon name="lock" className="text-[32px] text-outline" />
        <p className="font-title-md text-title-md text-on-surface">
          {role === 'admin' ? '관리자' : '크리에이터'} 권한이 필요한 화면이에요.
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed max-w-xs">
          {role === 'admin'
            ? '관리자(ADMIN) 계정으로 로그인하면 승인 심사와 추첨 실행을 사용할 수 있어요.'
            : '마이페이지에서 크리에이터 전환을 신청하고 관리자 승인을 받으면 사용할 수 있어요.'}
        </p>
        <Link
          to="/my-page"
          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-95 transition-all"
        >
          마이페이지로 가기
        </Link>
      </div>
    )
  }

  return children
}
