import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        <Link to="/">홈으로 돌아가기</Link>
      </p>
    </section>
  )
}
