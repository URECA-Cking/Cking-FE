import { useEffect, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { confirmQuizContent, cancelQuizGeneration } from '../../api/creatorQuizzes.js'
import { creatorQuizErrorMessage, isUncertainError } from '../../utils/quizJobs.js'
import { readReviewDraft, saveReviewDraft, clearReviewDraft, validateReviewText } from '../../utils/quizContentReview.js'

// 근거 종류. 응답 값은 화면에 그대로 쓰지 않는다.
const EVIDENCE_TYPE_LABELS = { SPEECH: '말한 내용', VISUAL: '화면 내용' }

export default function QuizContentReviewSheet({ creatorId, job, storage, drafts, onClose, onResult, onRefresh, onInaccessible }) {
  const content = job.content
  const [draft, setDraft] = useState(() => drafts.get(job.generationId) ?? readReviewDraft(storage, creatorId, job.generationId) ?? { text: content.aiContentText, pendingText: null })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  // 부모는 작업 ID와 표시 범위를 확인해 늦은 응답을 분리한다.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  function change(next) { drafts.set(job.generationId, next); setDraft(next); saveReviewDraft(storage, creatorId, job.generationId, next) }
  async function act(cancel) {
    if (inFlight.current) return
    const text = draft.pendingText ?? draft.text
    const invalid = validateReviewText(text, content.maxLength)
    if (!cancel && invalid) { setError(invalid); return }
    inFlight.current = true; setBusy(true); setError(null)
    if (!cancel) change({ text, pendingText: text })
    try {
      const result = cancel ? await cancelQuizGeneration(job.generationId) : await confirmQuizContent(job.generationId, text)
      clearReviewDraft(storage, creatorId, job.generationId)
      drafts.delete(job.generationId)
      onResult(result)
    } catch (failure) {
      if ([403, 404].includes(failure?.status)) {
        clearReviewDraft(storage, creatorId, job.generationId); onInaccessible(failure); return
      }
      if (failure?.status === 409) {
        if (failure.code === 'QUIZ_GENERATION_CONTENT_CONFLICT') clearReviewDraft(storage, creatorId, job.generationId)
        setError(creatorQuizErrorMessage(failure, '다른 화면에서 작업 상태가 바뀌었어요.'))
        try { await onRefresh() } catch { setError('최신 상태를 확인하지 못했어요. 다시 확인해 주세요.') }
      } else {
        if (!cancel && !isUncertainError(failure)) change({ text, pendingText: null })
        setError(isUncertainError(failure) ? '응답을 확인하지 못했어요. 같은 원문으로 다시 확인해 주세요.' : creatorQuizErrorMessage(failure, '요청을 처리하지 못했어요.'))
      }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }
  return <BottomSheet open onClose={() => { if (!busy) onClose() }} title="원문 검토" eyebrow="Quiz">
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">AI가 만든 원문과 근거는 실제 영상과 다를 수 있어요. 영상을 확인하고 원문을 확정해 주세요.</p>
      <label className="flex flex-col gap-2">원문
        <textarea aria-label="검토 원문" value={draft.text} disabled={busy || draft.pendingText !== null} rows={12}
          onChange={event => { change({ text: event.target.value, pendingText: null }); setConfirming(false) }}
          className="rounded-xl bg-surface-container-low p-space-md text-on-surface" />
      </label>
      <p>{draft.text.length}/{content.maxLength}자</p>
      <details><summary>AI 근거 {content.facts.length}개</summary>
        <ul>{content.facts.map((fact, index) => <li key={index} className="py-2"><p>{fact.fact}</p><p>{EVIDENCE_TYPE_LABELS[fact.evidenceType] ?? '근거 종류 확인 불가'} · {fact.timestampStart ?? '시각 없음'}{fact.timestampEnd ? ` ~ ${fact.timestampEnd}` : ''}</p><p>{fact.evidence}</p></li>)}</ul>
      </details>
      {error && <p role="alert" className="text-error">{error}</p>}
      {draft.pendingText !== null && <p>확정 응답을 확인하기 전에는 원문을 변경할 수 없어요. 같은 원문으로 다시 확인해 주세요.</p>}
      {confirming && <p role="alert">확정하면 원문을 다시 바꿀 수 없어요. 이 원문으로 문항을 생성할까요?</p>}
      <button disabled={busy || Boolean(validateReviewText(draft.text, content.maxLength))} className="rounded-xl bg-primary p-3 text-on-primary"
        onClick={() => confirming || draft.pendingText !== null ? act(false) : setConfirming(true)}>
        {busy ? '처리 중...' : draft.pendingText !== null ? '같은 원문으로 다시 확인' : confirming ? '확정하고 문항 생성' : '원문 확정'}
      </button>
      <button disabled={busy} onClick={() => act(true)} className="rounded-xl bg-surface-container p-3">생성 취소</button>
    </div>
  </BottomSheet>
}
