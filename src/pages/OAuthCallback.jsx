import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoadingBlock, ErrorBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { exchangeLoginCode } from '../api/auth.js'
import { applyCreator } from '../api/creatorApplications.js'
import { describeError } from '../api/client.js'
import { clearAccessToken } from '../api/authToken.js'
import { consumeLoginIntent } from '../utils/loginIntent.js'

// 백엔드가 redirect로 넘기는 error 값(Cking-BE docs/domains/auth/api.md "OAuth 로그인 시작")
const ERROR_MESSAGES = {
  access_denied: '로그인을 취소했어요.',
  provider_error: '로그인 제공자에서 인증하지 못했어요. 다시 시도해주세요.',
  login_processing_failed: '로그인을 처리하지 못했어요. 다시 시도해주세요.',
}

/**
 * OAuth 로그인 콜백(/oauth/callback?code=... 또는 ?error=...).
 * Login Code를 POST /api/auth/token으로 Access JWT와 교환하고, 로그인 전에 고른 값에 따라
 * 크리에이터 전환 신청을 접수한 뒤 원래 가려던 화면으로 보낸다.
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const showToast = useToast()
  // 이 화면에서는 UserProvider가 기존 세션을 복원하지 않으므로, 실패하면 직접 로그아웃 상태로 표시한다.
  const { loadUser, markSignedOut } = useUser()
  const [failure, setFailure] = useState(null)
  // Login Code는 한 번만 쓸 수 있으므로 StrictMode 등으로 effect가 두 번 돌아도 교환은 한 번만 한다.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const error = searchParams.get('error')
    const code = searchParams.get('code')
    const intent = consumeLoginIntent()

    if (error || !code) {
      markSignedOut()
      showToast(ERROR_MESSAGES[error] ?? '로그인하지 못했어요. 다시 시도해주세요.', { icon: 'error' })
      navigate('/login', { replace: true, state: { from: intent.redirectTo } })
      return
    }

    ;(async () => {
      try {
        await exchangeLoginCode(code)
        const me = await loadUser()
        if (!me) throw new Error('사용자 정보를 불러오지 못했어요.')

        if (intent.role === 'creator' && !me.creator) {
          try {
            await applyCreator()
            showToast(`${me.name}님, 크리에이터 전환 신청도 접수했어요.`)
          } catch (creatorError) {
            showToast(describeError(creatorError, '크리에이터 전환 신청에 실패했어요.'), { icon: 'error' })
          }
        } else {
          showToast(`${me.name}님, 환영해요.`)
        }
        navigate(intent.redirectTo || '/', { replace: true })
      } catch (err) {
        clearAccessToken()
        markSignedOut()
        setFailure(describeError(err, '로그인을 완료하지 못했어요. 다시 시도해주세요.'))
      }
    })()
  }, [searchParams, navigate, showToast, loadUser, markSignedOut])

  if (failure) {
    return <ErrorBlock message={failure} onRetry={() => navigate('/login', { replace: true })} />
  }
  return <LoadingBlock label="로그인하는 중..." />
}
