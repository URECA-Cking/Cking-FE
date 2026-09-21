import { useEffect, useRef, useState } from 'react'
import { getUsers, selectUser } from '../api/users'
import { clearCurrentUserId, getCurrentUserId, setCurrentUserId, subscribeCurrentUserId } from '../api/currentUser'

export default function User() {
  const [users, setUsers] = useState([])
  const [currentUserId, setLocalCurrentUserId] = useState(() => getCurrentUserId())
  const [error, setError] = useState('')
  // 선택/해제 동작마다 증가하는 순번. userId만으로는 "같은 사용자에게 두 번 요청"이나
  // "선택 도중 해제"를 구분할 수 없어서, 응답이 왔을 때 자신이 시작될 당시 받은 순번이
  // 지금 순번과 같을 때만(= 그 사이 더 최근 동작이 없었을 때만) 결과를 반영한다.
  const selectionTokenRef = useRef(0)

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
    const token = ++selectionTokenRef.current
    try {
      await selectUser(userId)
      if (selectionTokenRef.current === token) {
        setCurrentUserId(userId)
      }
    } catch (err) {
      if (selectionTokenRef.current === token) {
        setError(err.message)
      }
    }
  }

  function handleClear() {
    // 진행 중인 선택 요청이 나중에 응답으로 돌아와도 반영되지 않도록 순번을 올려 무효화한다.
    selectionTokenRef.current += 1
    setError('')
    clearCurrentUserId()
  }

  return (
    <section>
      <h1>사용자 선택</h1>
      <p>이 서비스에는 로그인이 없습니다. 여기서 선택한 사용자 ID를 요청 식별값으로만 사용합니다.</p>

      <p>
        현재 사용자: {currentUserId === null ? '미설정' : currentUserId}
        {currentUserId !== null && (
          <button type="button" onClick={handleClear}>
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
