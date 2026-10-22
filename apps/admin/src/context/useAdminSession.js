import { useContext } from 'react'
import { AdminSessionContext } from './adminSessionContext.js'

/** 관리자 세션 컨텍스트를 반환한다. */
export function useAdminSession() {
  return useContext(AdminSessionContext)
}
