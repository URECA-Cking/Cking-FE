import { createAccessTokenStore } from '@cking/shared/token'

// User Web의 세션 저장소. Admin과 key 및 origin이 모두 분리된다.
export const { getAccessToken, setAccessToken, clearAccessToken } = createAccessTokenStore('cking.accessToken')
