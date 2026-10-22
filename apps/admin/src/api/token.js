import { createAccessTokenStore } from '@cking/shared/token'

// Admin Access JWT만 저장한다. Refresh/Logout endpoint는 Admin 앱에서 소유한다.
export const { getAccessToken, setAccessToken, clearAccessToken } = createAccessTokenStore('cking.admin.accessToken')
