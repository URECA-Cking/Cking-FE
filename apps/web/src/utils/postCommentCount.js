// 댓글을 등록·삭제한 직후 게시글의 댓글 수를 서버 재조회 전에 목록 카드와 상세에 같이 보여 주기 위한 보정(Cking-FE 이슈 #239).
// BE 댓글 등록·삭제 응답에는 갱신된 댓글 수가 없으므로 화면이 보고 있던 값에 증감을 더한다. 값은 postId별 절대 수로 둬서
// 같은 게시글에 대한 연속 처리도 이중으로 더해지지 않는다. 좋아요 덮어쓰기(likeOverrides)와 같은 방식이다.

/**
 * 댓글 수 보정값에 증감을 반영한 새 보정값을 돌려준다. 이미 보정한 게시글은 그 값에서, 처음이면 서버가 준 수에서 시작한다.
 * 서버 수를 모르면(숫자가 아니면) 보정하지 않고 그대로 돌려준다. 수는 0 아래로 내려가지 않는다.
 */
export function adjustCommentCount(overrides, postId, serverCount, delta) {
  const current = overrides[postId] ?? serverCount
  if (typeof current !== 'number' || !Number.isFinite(current)) return overrides
  return { ...overrides, [postId]: Math.max(0, current + delta) }
}

/** 게시글에 보정한 댓글 수를 덮어쓴다. 보정값이 없으면 게시글 그대로다. */
export function applyCommentCount(post, overrides) {
  const count = overrides[post.postId]
  return count === undefined ? post : { ...post, commentCount: count }
}

/**
 * 목록을 새로 읽은 뒤 댓글 수 보정값을 정리한다. 새 목록 응답에 든 게시글은 서버의 최신 수가 이미 반영돼 있으므로 보정값을 버린다.
 * 열려 있는 상세 게시글이 새 목록에 없을 때만(다음 페이지에 있는 경우 등) 그 보정값을 남긴다.
 * detailCount는 새 목록에 열린 상세 게시글이 있을 때 상세가 들고 있는 옛 수를 갈아끼울 서버 값이다(없으면 undefined).
 */
export function reconcileCommentCounts(overrides, detailPostId, freshItems) {
  const fresh = detailPostId == null ? undefined : (freshItems ?? []).find((post) => post.postId === detailPostId)
  const freshCount = typeof fresh?.commentCount === 'number' ? fresh.commentCount : undefined
  const keepDetail = detailPostId != null && detailPostId in overrides && freshCount === undefined
  return { overrides: keepDetail ? { [detailPostId]: overrides[detailPostId] } : {}, detailCount: freshCount }
}
