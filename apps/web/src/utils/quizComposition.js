/** 문항 구성 전용 기록. Generation/Judge의 저장 형식과 키를 사용하지 않는다. */
export const compositionKey = (creatorId, quizId) => `cking.quizComposition.v1.${creatorId}.${quizId}`
const invalid = (message) => { throw new Error(message) }
const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(`${label} 입력을 확인해 주세요.`)
  return value.trim()
}
const duplicate = (value) => value.trim().normalize('NFC').replace(/\s+/g, ' ')
export function compositionDraft(revision) {
  return (revision.questions ?? []).map(q => ({ id: `source:${q.questionId}`, sourceQuestionId: q.questionId, selected: true,
    question: q.question, options: q.options.map(o => o.text), correctOptionIndex: q.correctOptionIndex,
    explanation: q.explanation, sourceEvidence: q.sourceEvidence ?? '', edited: false,
    changeType: q.changeType ?? null, evaluationStatus: q.evaluationStatus ?? 'NOT_EVALUATED', sourceEvaluation: q.sourceEvaluation ?? null }))
}
export function compositionStatus(question) {
  return !question.sourceQuestionId || question.changeType === 'CREATOR_ADDED'
    ? 'NOT_EVALUATED' : question.edited ? 'NOT_REVALIDATED' : question.evaluationStatus
}
export function compositionBody(revision, draft) {
  const selected = draft.filter(q => q.selected)
  if (selected.length < 1 || selected.length > 5) invalid('최종 문항은 1~5개를 선택해 주세요.')
  if (!revision.revisionId || !/^[0-9a-f]{64}$/.test(revision.revisionSha256 ?? '')) invalid('최신 문항 버전을 다시 확인해 주세요.')
  const seen = new Set(), sources = new Set()
  const questions = selected.map(q => {
    const question = text(q.question, 500, '문제'), explanation = text(q.explanation, 1000, '해설')
    if (!Array.isArray(q.options) || q.options.length !== 4) invalid('보기는 정확히 4개여야 해요.')
    const options = q.options.map(o => text(o, 200, '보기'))
    if (new Set(options.map(duplicate)).size !== 4) invalid('중복 보기를 수정해 주세요.')
    if (!Number.isInteger(q.correctOptionIndex) || q.correctOptionIndex < 0 || q.correctOptionIndex > 3) invalid('정답을 하나 선택해 주세요.')
    if (seen.has(duplicate(question))) invalid('중복 문제를 수정해 주세요.')
    seen.add(duplicate(question))
    if (q.sourceQuestionId) {
      if (sources.has(q.sourceQuestionId) || !revision.questions.some(o => o.questionId === q.sourceQuestionId)) invalid('문항 출처를 다시 확인해 주세요.')
      sources.add(q.sourceQuestionId)
    }
    const sourceEvidence = typeof q.sourceEvidence === 'string' ? q.sourceEvidence.trim() : ''
    if (sourceEvidence.length > 1000) invalid('근거는 1000자 이하로 입력해 주세요.')
    if (q.sourceQuestionId && !q.edited) return { sourceQuestionId: q.sourceQuestionId }
    return { ...(q.sourceQuestionId ? { sourceQuestionId: q.sourceQuestionId } : {}), content: { question, options, correctOptionIndex: q.correctOptionIndex, explanation, sourceEvidence } }
  })
  return { baseRevisionId: revision.revisionId, baseRevisionSha256: revision.revisionSha256, questions }
}
export function readComposition(storage, key) {
  try {
    if (!storage) return { ok: false, entry: null }
    const raw = storage.getItem(key)
    if (!raw) return { ok: true, entry: null }
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.requestId !== 'string' || !Number.isSafeInteger(entry.body?.baseRevisionId) || entry.body.baseRevisionId <= 0
      || !/^[a-f0-9]{64}$/.test(entry.body?.baseRevisionSha256 ?? '') || !Array.isArray(entry.body.questions)
      || entry.body.questions.length < 1 || entry.body.questions.length > 5
      || (entry.result != null && (!Number.isSafeInteger(entry.result.revisionId) || entry.result.revisionId <= 0
        || !/^[a-f0-9]{64}$/.test(entry.result.revisionSha256 ?? '')))
      || entry.body.questions.some(q => !q || (q.sourceQuestionId == null && !q.content)
        || (q.sourceQuestionId != null && (!Number.isSafeInteger(q.sourceQuestionId) || q.sourceQuestionId <= 0))
        || (q.content && (!Array.isArray(q.content.options) || q.content.options.length !== 4
          || q.content.options.some(o => typeof o !== 'string') || typeof q.content.question !== 'string'
          || typeof q.content.explanation !== 'string')))) return { ok: false, entry: null }
    return { ok: true, entry }
  } catch { return { ok: false, entry: null } }
}
function write(storage, key, entry) {
  try {
    const raw = JSON.stringify(entry)
    storage.setItem(key, raw)
    return { ok: storage.getItem(key) === raw, entry }
  } catch { return { ok: false, entry } }
}
export function reserveComposition(storage, key, body, requestId) {
  const current = readComposition(storage, key)
  if (!current.ok) return { ok: false, entry: current.entry }
  if (current.entry && !current.entry.result) {
    return { ok: JSON.stringify(current.entry.body) === JSON.stringify(body), entry: current.entry }
  }
  if (current.entry?.result && current.entry.body.baseRevisionId === body.baseRevisionId) {
    return { ok: JSON.stringify(current.entry.body) === JSON.stringify(body), entry: current.entry }
  }
  return write(storage, key, { requestId, body, result: null })
}
export function settleComposition(storage, key, requestId, result, failure = null) {
  const current = readComposition(storage, key)
  if (!current.ok || current.entry?.requestId !== requestId) return { ...current, applied: false }
  if (current.entry.result && !result) return { ...current, applied: false }
  const saved = write(storage, key, { ...current.entry, ...(result ? { result, failure: null } : { failure }) })
  return { ...saved, applied: saved.ok }
}
export async function compositionLock(key, task) {
  if (!globalThis.navigator?.locks?.request) return { ok: false, applied: false }
  try { return await navigator.locks.request(key, task) } catch { return { ok: false, applied: false } }
}
export function restoreCompositionDraft(revision, body) {
  if (body.baseRevisionId !== revision.revisionId || body.baseRevisionSha256 !== revision.revisionSha256) invalid('복원 기준 문항 버전이 다릅니다.')
  const originals = compositionDraft(revision)
  const draft = body.questions.map((q, i) => {
    const original = originals.find(o => o.sourceQuestionId === q.sourceQuestionId)
    if (q.sourceQuestionId != null && !original) invalid('복원 문항이 기준 문항 버전에 없습니다.')
    return q.content ? { ...(original ?? {}), ...q.content, id: original?.id ?? `restored:${i}`, sourceQuestionId: q.sourceQuestionId,
      selected: true, edited: !!q.sourceQuestionId, evaluationStatus: original?.evaluationStatus ?? 'NOT_EVALUATED' } : original
  })
  if (JSON.stringify(compositionBody(revision, draft)) !== JSON.stringify(body)) invalid('복원 요청이 정규화된 본문과 다릅니다.')
  return draft
}

/** 명확히 거절된 기준 충돌만 사용자가 새 기준을 선택할 때 해제한다. */
export function releaseRejectedComposition(storage, key, expectedRequestId) {
  const current = readComposition(storage, key)
  if (!current.ok || current.entry?.requestId !== expectedRequestId || current.entry.result
    || current.entry.failure?.code !== 'QUIZ_REVISION_CONFLICT') return { ...current, applied: false }
  try {
    storage.removeItem(key)
    return { ok: storage.getItem(key) === null, applied: storage.getItem(key) === null, entry: null }
  } catch { return { ok: false, applied: false, entry: current.entry } }
}
