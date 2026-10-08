import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../MaterialIcon.jsx'
import { describeError } from '../../api/client.js'
import { useAdminSession } from '../../context/useAdminSession.js'
import { useToast } from '../../context/useToast.js'

/** 세션 식별 정보와 기존 관리자 로그아웃을 제공하는 공통 헤더다. */
export default function AdminHeader() {
  const navigate = useNavigate()
  const { user, signOut } = useAdminSession()
  const showToast = useToast()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      showToast(describeError(error, '로그아웃하지 못했습니다. 다시 시도해주세요.'), { icon: 'error' })
    }
  }

  const identifier = user?.name ?? user?.loginId ?? user?.email ?? 'ADMIN'

  return (
    <header className="sticky top-0 z-20 flex h-16 min-w-[1024px] items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-2 text-slate-950"><span className="grid h-7 w-7 place-items-center rounded bg-pink-600 text-xs font-bold text-white">C</span><span className="text-sm font-semibold tracking-[0.08em]">CKING ADMIN</span></div>
      <div className="flex items-center gap-3"><span className="text-sm text-slate-600">{identifier}</span><button type="button" onClick={handleSignOut} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"><MaterialIcon name="logout" className="text-[18px]" />로그아웃</button></div>
    </header>
  )
}
