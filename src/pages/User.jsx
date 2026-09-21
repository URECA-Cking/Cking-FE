import { useEffect, useRef, useState } from 'react'
import { getUsers, selectUser } from '../api/users'
import { clearCurrentUserId, getCurrentUserId, setCurrentUserId, subscribeCurrentUserId } from '../api/currentUser'

export default function User() {
  const [users, setUsers] = useState([])
  const [currentUserId, setLocalCurrentUserId] = useState(() => getCurrentUserId())
  const [error, setError] = useState('')
  // 선택 요청이 겹칠 때 응답 도착 순서가 아니라 "가장 마지막으로 누른 선택"이 이기도록
  // 마지막 요청의 userId를 기록해두고, 응답이 왔을 때 이 값과 다르면 무시한다.
  const latestSelectionRef = useRef(null)

  useEffect(() => subscribeCurrentUserId(() => setLocalCurrentUserId(getCurrentUserId())), [])

  useEffect(() => {
    const controller = new AbortController()
    getUsers(controller.signal)
      .then((data) => setUsers(data.items))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
    return () => controller.abort()
  }, [])

  async function handleSelect(userId) {
    setError('')
    latestSelectionRef.current = userId
    try {
      await selectUser(userId)
      if (latestSelectionRef.current === userId) {
        setCurrentUserId(userId)
      }
    } catch (err) {
      if (latestSelectionRef.current === userId) {
        setError(err.message)
      }
    }
  }

  return (
    <section>
      <h1>사용자 선택</h1>
      <p>이 서비스에는 로그인이 없습니다. 여기서 선택한 사용자 ID를 요청 식별값으로만 사용합니다.</p>

      <p>
        현재 사용자: {currentUserId === null ? '미설정' : currentUserId}
        {currentUserId !== null && (
          <button type="button" onClick={clearCurrentUserId}>
            해제
          </button>
        )}
      </p>

      {error && <p role="alert">{error}</p>}

      <ul>
        {users.map((user) => (
          <li key={user.userId}>
            {user.name} ({user.userId})
            <button type="button" onClick={() => handleSelect(user.userId)}>
              선택
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
