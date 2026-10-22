import { useContext } from 'react'
import MyTicketsContext from './myTicketsContext.js'

export function useMyTickets() {
  const ctx = useContext(MyTicketsContext)
  if (!ctx) {
    throw new Error('useMyTickets는 MyTicketsProvider 내부에서만 사용할 수 있습니다.')
  }
  return ctx
}
