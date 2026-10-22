import { Component } from 'react'
import { ErrorBlock } from './States.jsx'

/**
 * 지연 로딩한 화면의 JS 조각을 받지 못했을 때(네트워크 오류, 배포로 바뀐 파일 등) 빈 화면 대신 안내와 새로고침을 보여준다.
 * Suspense는 불러오는 중만 다루고 실패는 다루지 못한다. 실패한 import는 React가 기억하므로 복구는 새로고침으로 한다.
 * resetKey가 바뀌면(다른 화면으로 이동하면) 오류 상태를 풀어 새 화면을 다시 그린다.
 */
export default class ChunkErrorBoundary extends Component {
  state = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey === state.resetKey) return null
    return { failed: false, resetKey: props.resetKey }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <ErrorBlock
        message="화면을 불러오지 못했어요. 네트워크를 확인한 뒤 새로고침해 주세요."
        onRetry={() => window.location.reload()}
      />
    )
  }
}
