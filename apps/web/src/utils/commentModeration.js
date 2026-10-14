// 댓글창에서 남의 댓글을 조치(작성자 차단·댓글 삭제)할 수 있는 사람과 호출할 API를 가르는 규칙.
// 관리자도 크리에이터와 같은 댓글창을 보지만 호출하는 API는 다르다(관리자는 소유 관계를 따지지 않는 관리자 API).
// 허용 여부는 BE가 최종 판단하고, 이 파일은 화면에서 메뉴를 보일지 정하는 용도다.

/**
 * 이 댓글창에서 조치할 때의 자격. 게시글 주인(크리에이터)이면 크리에이터 API를 쓰므로 그쪽이 우선이고,
 * 아니고 관리자면 관리자 API를 쓴다. 둘 다 아니면 null이다.
 *
 * @returns {'creator' | 'admin' | null}
 */
export function moderationActor({ isMine, isAdmin }) {
  if (isMine) return 'creator'
  return isAdmin ? 'admin' : null
}

/** 댓글 작성자를 차단하는 메뉴를 보일지. 로그인한 조치 자격자가 남의 댓글을 볼 때만이고, 작성자 ID가 있어야 한다(가려진 댓글도 ID는 온다). */
export function canBlockAuthor({ authenticated, actor, isOwn, authorMemberId }) {
  return Boolean(authenticated) && actor !== null && !isOwn && authorMemberId != null
}

/** 댓글 삭제 버튼을 보일지. 작성자 본인과 조치 자격자(게시글 주인·관리자)다. */
export function canDeleteComment({ authenticated, actor, isOwn }) {
  return Boolean(authenticated) && (Boolean(isOwn) || actor !== null)
}

/** 삭제 요청에 쓸 API. 본인 댓글은 작성자 API, 남의 댓글은 자격에 따라 크리에이터 API 또는 관리자 API다. */
export function deleteRoute({ actor, isOwn }) {
  if (isOwn) return 'author'
  return actor === 'admin' ? 'admin' : 'creator'
}
