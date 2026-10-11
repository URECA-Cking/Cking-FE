// 개발 전용 mock: Cking-BE에 아직 없는 값(팔로워 수, 게시글 좋아요·댓글 수)을 화면 확인용으로 채운다.
// 필드 이름은 임시이며, 계약의 정본은 Cking-BE다. BE가 값을 내려주면 이 파일과 호출부를 지운다.
// 개발 서버(import.meta.env.DEV)에서 주소에 `?mock=1`을 붙였을 때만 동작한다. 기본은 실제 BE 응답 그대로다.
// 배포 빌드에서는 export가 입력을 그대로 돌려주는 함수로 대체되어 mock 코드가 번들에서 빠진다.

const passthrough = (value) => value

function createMocks() {
  const enabled = () => new URLSearchParams(window.location.search).get('mock') === '1'
  const seeded = (id, max) => (Number(id) * 7919) % max

  return {
    /** 스페이스 응답에 followerCount가 없으면 채운다. */
    space(space) {
      if (!enabled() || !space || typeof space.followerCount === 'number') return space
      return { ...space, followerCount: 1200 + seeded(space.creatorId, 90000) }
    },
    /** 게시글 응답에 likeCount·liked·commentCount가 없으면 채운다. */
    post(post) {
      if (!enabled() || !post || typeof post.likeCount === 'number') return post
      return {
        ...post,
        likeCount: seeded(post.postId, 5000),
        liked: false,
        commentCount: seeded(post.postId + 3, 120),
      }
    },
  }
}

const mocks = import.meta.env.DEV ? createMocks() : null

export const withMockSpace = import.meta.env.DEV ? mocks.space : passthrough
export const withMockPost = import.meta.env.DEV ? mocks.post : passthrough
