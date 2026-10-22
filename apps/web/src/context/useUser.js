import { useContext } from 'react'
import UserContext from './userContext.js'

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser는 UserProvider 내부에서만 사용할 수 있습니다.')
  }
  return ctx
}
