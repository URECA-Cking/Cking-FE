export const isAwaitingContentReview = job => job?.status === 'RUNNING' && job?.reviewStage === 'AWAITING_REVIEW'
export const reviewDraftKey = (creatorId, generationId) => `cking.creatorQuizReviewDraft.v1.${creatorId}.${generationId}`
export function validateReviewText(text, maxLength = 50000) {
  if (typeof text !== 'string' || !text.trim()) return '원문을 입력해 주세요.'
  if (text.length > Math.min(maxLength, 50000)) return '원문은 최대 50,000자까지 입력할 수 있어요.'
  return null
}
export function readReviewDraft(storage, creatorId, generationId) {
  try {
    const value = JSON.parse(storage?.getItem(reviewDraftKey(creatorId, generationId)) ?? 'null')
    if (value?.generationId !== generationId || typeof value.text !== 'string' || value.text.length > 100000) return null
    return { text: value.text, pendingText: typeof value.pendingText === 'string' ? value.pendingText : null }
  } catch { return null }
}
export function saveReviewDraft(storage, creatorId, generationId, draft) {
  try { if (!storage) return false; storage.setItem(reviewDraftKey(creatorId, generationId), JSON.stringify({ ...draft, generationId })); return true } catch { return false }
}
export function clearReviewDraft(storage, creatorId, generationId) {
  try { storage?.removeItem(reviewDraftKey(creatorId, generationId)) } catch { /* 메모리의 수정본은 계속 사용할 수 있다. */ }
}
